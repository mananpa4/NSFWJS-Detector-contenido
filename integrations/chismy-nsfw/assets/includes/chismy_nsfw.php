<?php
/**
 * Chismy NSFW moderation (imagen) + refuerzo de texto prohibido.
 *
 * Contexto: el SafeSearch nativo de WoWonder (`detect_safe_search()`) exige
 * Google Vision API de pago y, sin clave valida, deja pasar todo (devuelve
 * true ante cualquier error). Este modulo anade una capa sin costo:
 *
 *  - Pre-chequeo en navegador con NSFWJS (ver assets/js/chismy-nsfw-precheck.js):
 *    avisa/bloquea antes de subir y envia su veredicto en `chismy_nsfw`.
 *  - Servidor: hace cumplir el veredicto (best-effort: el cliente puede
 *    mentir), registra cada subida con media en `Wo_Chismy_Media_Moderation`
 *    y manda a revision (`Wo_Posts.active = 0`, flujo nativo de aprobacion)
 *    lo que el cliente marco como dudoso.
 *  - Texto: bloqueo servidor 100% confiable por n. de hits de palabras
 *    prohibidas (ver Wo_ProfanityCountHits()).
 *
 * Deteccion 100% en servidor requiere VPS con el stack NSFWJS-Detector
 * (fase 2: `nsfw_api_url`). Sin eso, esto es la mejor defensa posible en
 * cPanel compartido, junto a reportes de usuarios y revision manual.
 */

if (!defined('T_CHISMY_MEDIA_MOD')) {
    define('T_CHISMY_MEDIA_MOD', 'Wo_Chismy_Media_Moderation');
}

function ChismyNsfwSettings() {
    global $wo;
    static $settings = null;
    if ($settings !== null) {
        return $settings;
    }
    $config = isset($wo['config']) && is_array($wo['config']) ? $wo['config'] : array();
    $settings = array(
        'enabled' => (!empty($config['nsfw_precheck_enabled']) && $config['nsfw_precheck_enabled'] === 'on'),
        'block_score' => isset($config['nsfw_block_score']) ? (float) $config['nsfw_block_score'] : 0.60,
        'review_score' => isset($config['nsfw_review_score']) ? (float) $config['nsfw_review_score'] : 0.35,
        'text_block_hits' => isset($config['nsfw_text_block_hits']) ? (int) $config['nsfw_text_block_hits'] : 3,
        'tfjs_url' => !empty($config['nsfw_cdn_tfjs']) ? $config['nsfw_cdn_tfjs'] : 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs',
        'nsfwjs_url' => !empty($config['nsfw_cdn_nsfwjs']) ? $config['nsfw_cdn_nsfwjs'] : 'https://cdn.jsdelivr.net/npm/nsfwjs',
        'api_url' => isset($config['nsfw_api_url']) ? trim((string) $config['nsfw_api_url']) : '',
    );
    return $settings;
}

function ChismyNsfwEnsureTable() {
    global $sqlConnect;
    static $ready = null;
    if ($ready !== null) {
        return $ready;
    }
    if (empty($sqlConnect)) {
        return $ready = false;
    }
    // Mismo charset del dump (utf8mb3), no utf8mb4: evita mezclas de collation.
    $sql = "CREATE TABLE IF NOT EXISTS `" . T_CHISMY_MEDIA_MOD . "` ("
        . "`id` int(11) NOT NULL AUTO_INCREMENT,"
        . "`user_id` int(11) NOT NULL DEFAULT 0,"
        . "`post_id` int(11) NOT NULL DEFAULT 0,"
        . "`kind` varchar(16) NOT NULL DEFAULT 'post',"
        . "`filename` varchar(255) NOT NULL DEFAULT '',"
        . "`client_porn` decimal(5,4) NOT NULL DEFAULT 0,"
        . "`client_sexy` decimal(5,4) NOT NULL DEFAULT 0,"
        . "`client_verdict` varchar(16) NOT NULL DEFAULT 'unverified',"
        . "`status` varchar(16) NOT NULL DEFAULT 'approved',"
        . "`created_at` int(11) NOT NULL DEFAULT 0,"
        . "PRIMARY KEY (`id`), KEY `user_id` (`user_id`), KEY `post_id` (`post_id`), KEY `status` (`status`)"
        . ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci";
    return $ready = (bool) mysqli_query($sqlConnect, $sql);
}

/**
 * Valida el veredicto que envia el pre-chequeo del navegador.
 * Devuelve null si viene vacio o corrupto (subida sin verificar).
 */
function ChismyNsfwParseVerdict($raw) {
    if (empty($raw) || !is_string($raw)) {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return null;
    }
    $porn = isset($data['porn']) ? max(0, min(1, (float) $data['porn'])) : 0;
    $sexy = isset($data['sexy']) ? max(0, min(1, (float) $data['sexy'])) : 0;
    $verdict = isset($data['verdict']) ? (string) $data['verdict'] : 'ok';
    if (!in_array($verdict, array('ok', 'review', 'block'), true)) {
        $verdict = 'ok';
    }
    return array('porn' => $porn, 'sexy' => $sexy, 'verdict' => $verdict, 'risky' => $porn + $sexy);
}

/**
 * Decision combinada texto + imagen para un post/comentario.
 * Devuelve array('action' => ok|review|block, 'message', 'text_hits', 'verdict').
 */
function ChismyNsfwEvaluate($post_text, $verdict_raw) {
    $settings = ChismyNsfwSettings();
    $result = array('action' => 'ok', 'message' => '', 'text_hits' => 0, 'verdict' => null);
    if (!$settings['enabled']) {
        return $result;
    }

    // 1) Texto: 100% servidor, confiable. Bloquea por n. de hits.
    $hits = function_exists('Wo_ProfanityCountHits') ? Wo_ProfanityCountHits((string) $post_text) : 0;
    $result['text_hits'] = $hits;
    if ($settings['text_block_hits'] > 0 && $hits >= $settings['text_block_hits']) {
        $result['action'] = 'block';
        $result['message'] = 'El texto contiene demasiadas palabras no permitidas (' . $hits . '). Revisalo antes de publicar.';
        return $result;
    }

    // 2) Imagen: veredicto del navegador (best-effort, el cliente puede mentir).
    $verdict = ChismyNsfwParseVerdict($verdict_raw);
    $result['verdict'] = $verdict;
    if ($verdict === null) {
        return $result;
    }
    if ($verdict['verdict'] === 'block' || $verdict['risky'] >= $settings['block_score']) {
        $result['action'] = 'block';
        $result['message'] = 'La imagen no cumple las politicas de contenido de Chismy.';
        return $result;
    }
    if ($verdict['verdict'] === 'review' || $verdict['risky'] >= $settings['review_score']) {
        $result['action'] = 'review';
        $result['message'] = '';
    }
    return $result;
}

/**
 * Registra los archivos de un post/comentario en la cola de revision.
 * $filenames: lista de nombres tal como los guarda Wo_ShareFile().
 */
function ChismyNsfwLogMedia($user_id, $post_id, $kind, $filenames, $eval) {
    global $sqlConnect;
    if (empty($filenames) || !ChismyNsfwEnsureTable()) {
        return;
    }
    $user_id = (int) $user_id;
    $post_id = (int) $post_id;
    $verdict = is_array($eval) && isset($eval['verdict']) ? $eval['verdict'] : null;
    $action = is_array($eval) && isset($eval['action']) ? $eval['action'] : 'ok';
    $status = $action === 'review' ? 'pending' : 'approved';
    foreach ((array) $filenames as $filename) {
        $filename = (string) $filename;
        if ($filename === '') {
            continue;
        }
        $safe_name = mysqli_real_escape_string($sqlConnect, mb_substr($filename, 0, 255));
        $porn = $verdict !== null ? (float) $verdict['porn'] : 0;
        $sexy = $verdict !== null ? (float) $verdict['sexy'] : 0;
        $client = $verdict !== null ? $verdict['verdict'] : 'unverified';
        // Sin veredicto del navegador (JS desactivado, video, avatar): se
        // registra como aprobada pero auditable. Solo el veredicto 'review'
        // del cliente manda a la cola pendiente (menos ruido, mismo rastro).
        mysqli_query(
            $sqlConnect,
            "INSERT INTO `" . T_CHISMY_MEDIA_MOD . "` "
            . "(`user_id`,`post_id`,`kind`,`filename`,`client_porn`,`client_sexy`,`client_verdict`,`status`,`created_at`) VALUES "
            . "({$user_id},{$post_id},'" . ($kind === 'comment' ? 'comment' : 'post') . "','{$safe_name}',{$porn},{$sexy},'{$client}', '{$status}'," . time() . ")"
        );
    }
}

function ChismyNsfwJsonBlock($message) {
    header("Content-type: application/json");
    echo json_encode(array('status' => 400, 'errors' => $message));
    exit();
}
