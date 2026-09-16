/* ============================================================================
 * Chismy NSFW pre-check (navegador).
 *
 * Clasifica imagenes con NSFWJS (TensorFlow.js, CDN) ANTES de subir:
 *  - score alto  -> bloquea la seleccion y avisa (no se sube nada).
 *  - score medio -> permite subir pero marca el post para revision
 *    (el servidor lo publica con active=0, flujo nativo de aprobacion).
 *  - videos      -> NSFWJS solo ve imagenes: se suben sin veredicto y el
 *    servidor los registra para revision manual (fase 2: API en VPS).
 *
 * Cero dependencias propias (usa el jQuery del tema). Si el CDN o el modelo
 * fallan, no rompe nada: el formulario se envia sin veredicto y el servidor
 * aplica el filtro de texto + reportes como siempre.
 * Config desde window.ChismyNsfw (inyectado en container.phtml de cada tema).
 * ============================================================================ */
(function ($) {
  'use strict';

  var cfg = window.ChismyNsfw || {};
  if (!cfg.enabled) {
    return;
  }

  var BLOCK_AT = parseFloat(cfg.blockScore) || 0.60;
  var REVIEW_AT = parseFloat(cfg.reviewScore) || 0.35;
  var TFJS_URL = cfg.tfjs || 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs';
  var NSFWJS_URL = cfg.nsfwjs || 'https://cdn.jsdelivr.net/npm/nsfwjs';

  // Peor veredicto visto por formulario (clave = elemento form).
  var formVerdicts = [];
  var modelPromise = null;
  var modelFailed = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function getModel() {
    if (modelPromise) {
      return modelPromise;
    }
    modelPromise = loadScript(TFJS_URL)
      .then(function () { return loadScript(NSFWJS_URL); })
      .then(function () { return window.nsfwjs.load(); })
      .catch(function () { modelFailed = true; return null; });
    return modelPromise;
  }

  // Arranca la descarga en segundo plano con la primera interaccion.
  $(document).one('mouseenter focus', 'input[type="file"]', function () {
    getModel();
  });

  function isImageFile(file) {
    if (!file) {
      return false;
    }
    if (file.type && file.type.indexOf('image/') === 0) {
      return true;
    }
    return /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name || '');
  }

  function classifyFile(file) {
    return getModel().then(function (model) {
      if (!model) {
        return null;
      }
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var max = 512;
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            model.classify(canvas).then(function (preds) {
              URL.revokeObjectURL(url);
              var porn = 0, sexy = 0;
              (preds || []).forEach(function (p) {
                if (p.className === 'Porn') { porn = p.probability; }
                if (p.className === 'Sexy') { sexy = p.probability; }
              });
              resolve({ porn: porn, sexy: sexy });
            }).catch(function () { URL.revokeObjectURL(url); resolve(null); });
          } catch (e) {
            URL.revokeObjectURL(url);
            resolve(null);
          }
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    });
  }

  function worstOf(list) {
    var worst = { porn: 0, sexy: 0, verdict: 'ok' };
    list.forEach(function (s) {
      if (!s) {
        return;
      }
      var risky = s.porn + s.sexy;
      if (risky >= BLOCK_AT) {
        worst = { porn: s.porn, sexy: s.sexy, verdict: 'block' };
      } else if (worst.verdict !== 'block' && risky >= REVIEW_AT) {
        worst = { porn: s.porn, sexy: s.sexy, verdict: 'review' };
      }
    });
    return worst;
  }

  function setFormVerdict(form, verdict) {
    var found = false;
    for (var i = 0; i < formVerdicts.length; i++) {
      if (formVerdicts[i].form === form) {
        formVerdicts[i].verdict = verdict;
        found = true;
      }
    }
    if (!found) {
      formVerdicts.push({ form: form, verdict: verdict });
    }
  }

  function getFormVerdict(form) {
    for (var i = 0; i < formVerdicts.length; i++) {
      if (formVerdicts[i].form === form) {
        return formVerdicts[i].verdict;
      }
    }
    return null;
  }

  // 1) Al elegir archivos: clasificar imagenes y bloquear en el acto si toca.
  $(document).on('change', 'input[type="file"]', function () {
    var input = this;
    var files = input.files ? Array.prototype.slice.call(input.files) : [];
    var images = files.filter(isImageFile);
    if (images.length === 0) {
      return;
    }
    // Calentado del modelo ya disparado por mouseenter/focus; si aun no esta,
    // se clasifica igual (la promesa espera la descarga).
    Promise.all(images.map(classifyFile)).then(function (scores) {
      var verdict = worstOf(scores);
      var form = $(input).closest('form')[0] || null;
      if (form) {
        setFormVerdict(form, verdict);
      }
      if (verdict.verdict === 'block') {
        $(input).val('');
        if (form) {
          setFormVerdict(form, { porn: 0, sexy: 0, verdict: 'ok' });
        }
        alert('Esta imagen no cumple las politicas de contenido de Chismy y no se puede subir.');
      } else if (verdict.verdict === 'review') {
        if (!input.dataset.chismyNsfwWarned) {
          input.dataset.chismyNsfwWarned = '1';
          alert('Aviso: la imagen se marco para revision antes de publicarse.');
        }
      }
    });
  });

  // 2) Al enviar el publisher (form.post en los 5 temas): adjuntar veredicto.
  $(document).on('submit', 'form.post', function () {
    var form = this;
    var verdict = getFormVerdict(form);
    if (!verdict) {
      // Sin imagenes o modelo aun no listo: se envia sin veredicto.
      return;
    }
    var hidden = form.querySelector('input[name="chismy_nsfw"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'chismy_nsfw';
      form.appendChild(hidden);
    }
    hidden.value = JSON.stringify({
      porn: verdict.porn,
      sexy: verdict.sexy,
      verdict: verdict.verdict,
      model: 'nsfwjs'
    });
    if (verdict.verdict === 'block') {
      alert('Esta imagen no cumple las politicas de contenido de Chismy y no se puede publicar.');
    }
  });

  if (modelFailed) {
    // Silencioso a proposito: sin modelo no hay pre-chequeo, el servidor manda.
  }
})(window.jQuery || window.$);
