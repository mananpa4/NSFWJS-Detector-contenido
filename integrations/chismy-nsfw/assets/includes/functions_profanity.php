<?php
/**
 * Extended profanity / forbidden-words filter.
 *
 * Wo_Config('censored_words') alone caps the list at VARCHAR(20000) with no
 * validation (Wo_SaveConfig silently truncates/fails past that). This adds an
 * unlimited, JSON-backed "extra" word list on top of it, plus an optional
 * "removed" list to exclude a legacy word without editing the config CSV.
 * Approach adapted from dowdes.com's ProfanityFilter service (base + extra +
 * removed layers, whole-word matching instead of raw substring replace).
 */

define('CENSORED_WORDS_EXTRA_FILE', dirname(__DIR__) . '/data/censored_words_extra.json');
define('CENSORED_WORDS_REMOVED_FILE', dirname(__DIR__) . '/data/censored_words_removed.json');

function Wo_ProfanityReadJsonList($file) {
    if (!file_exists($file)) {
        return array();
    }
    $data = json_decode((string) @file_get_contents($file), true);
    if (empty($data['words']) || !is_array($data['words'])) {
        return array();
    }
    return $data['words'];
}

function Wo_ProfanityWriteJsonList($file, $words) {
    $words = array_map('trim', $words);
    $words = array_values(array_unique(array_filter($words, 'strlen')));
    sort($words);
    $json = json_encode(array('words' => $words), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return @file_put_contents($file, $json) !== false;
}

function Wo_ProfanityBaseWords() {
    global $config;
    $csv   = !empty($config['censored_words']) ? $config['censored_words'] : '';
    $words = array_map('trim', explode(',', $csv));
    return array_values(array_filter($words, 'strlen'));
}

function Wo_ProfanityExtraWords() {
    return Wo_ProfanityReadJsonList(CENSORED_WORDS_EXTRA_FILE);
}

function Wo_ProfanityRemovedWords() {
    return Wo_ProfanityReadJsonList(CENSORED_WORDS_REMOVED_FILE);
}

function Wo_ProfanityWordSet() {
    static $set = null;
    if ($set !== null) {
        return $set;
    }
    $removed = array_map('mb_strtolower', Wo_ProfanityRemovedWords());
    $set     = array();
    foreach (array_merge(Wo_ProfanityBaseWords(), Wo_ProfanityExtraWords()) as $word) {
        $lower = mb_strtolower(trim($word));
        if ($lower === '' || in_array($lower, $removed, true)) {
            continue;
        }
        $set[$lower] = true;
    }
    return $set;
}

function Wo_ProfanityWordCount() {
    return count(Wo_ProfanityWordSet());
}

/**
 * Bulk-replaces the "extra" (unlimited, admin-managed) word list.
 * $text may be comma- and/or newline-separated.
 */
function Wo_ProfanitySaveExtraWords($text) {
    $words = preg_split('/[,\r\n]+/u', (string) $text);
    return Wo_ProfanityWriteJsonList(CENSORED_WORDS_EXTRA_FILE, $words);
}

/**
 * Masks $word the same way dowdes.com and shomex.com.mx do (both
 * App\Services\ProfanityFilter::mask()): keep the first floor(len/2)
 * characters visible, replace the rest with asterisks — e.g. "pendejo" (7)
 * -> "pen" (3 shown) + "****" (4 masked) = "pen****". Kept consistent across
 * all three sites on purpose.
 */
function Wo_ProfanityMask($word) {
    $len = mb_strlen($word);
    if ($len <= 1) {
        return str_repeat('*', max(1, $len));
    }
    $shown = (int) floor($len / 2);
    return mb_substr($word, 0, $shown) . str_repeat('*', $len - $shown);
}

/**
 * Posibles singulares de $word, para que la lista solo tenga que declarar el
 * singular: con "casino" en la lista, "casinos" tambien se detecta.
 *
 * Se deriva el singular en tiempo de coincidencia en vez de precalcular los
 * plurales de toda la lista: la lista la escribe un humano y no siempre pluraliza
 * de forma regular, y asi el conjunto no se duplica en memoria.
 *
 * Cubre espanol e ingles, que son los idiomas de Chismy:
 *   es  casinos->casino | papeles->papel | luces->luz | lapices->lapiz
 *   en  cats->cat | boxes->box | cities->city | knives->knife/knifes
 *
 * Limite conocido: el espanol desplaza el acento al pluralizar
 * ("avion"->"aviones"), asi que de "aviones" se deriva "avion" sin tilde y
 * tambien la variante con tilde en la ultima vocal ("avión"). Si la lista
 * trae otra forma acentuada rara, hay que anadirla a mano.
 */
function Wo_ProfanityAccentLastVowel($stem) {
    $map = array('a' => 'á', 'e' => 'é', 'i' => 'í', 'o' => 'ó', 'u' => 'ú');
    $len = mb_strlen($stem);
    for ($i = $len - 1; $i >= 0; $i--) {
        $char = mb_substr($stem, $i, 1);
        if (isset($map[$char])) {
            return mb_substr($stem, 0, $i) . $map[$char] . mb_substr($stem, $i + 1);
        }
    }
    return null;
}
function Wo_ProfanitySingularCandidates($word) {
    $candidates = array();
    $len        = mb_strlen($word);
    // Menos de 4 letras: quitar la "s" produce demasiados falsos positivos
    // ("dos" -> "do", "mas" -> "ma").
    if ($len < 4 || mb_substr($word, -1) !== 's') {
        return $candidates;
    }

    // ingles: cities -> city
    if (mb_substr($word, -3) === 'ies') {
        $candidates[] = mb_substr($word, 0, $len - 3) . 'y';
    }
    // ingles: knives -> knife / knifes
    if (mb_substr($word, -3) === 'ves') {
        $stem         = mb_substr($word, 0, $len - 3);
        $candidates[] = $stem . 'fe';
        $candidates[] = $stem . 'f';
    }
    // espanol: luces -> luz, lapices -> lapiz
    if (mb_substr($word, -3) === 'ces') {
        $candidates[] = mb_substr($word, 0, $len - 3) . 'z';
    }
    // espanol: papeles -> papel | ingles: boxes -> box, churches -> church
    if (mb_substr($word, -2) === 'es') {
        $stem = mb_substr($word, 0, $len - 2);
        $candidates[] = $stem;
        // aviones -> avion -> avión: la tilde se pierde al pluralizar.
        $accented = Wo_ProfanityAccentLastVowel($stem);
        if ($accented !== null) {
            $candidates[] = $accented;
        }
    }
    // caso general: casinos -> casino, cats -> cat
    $candidates[] = mb_substr($word, 0, $len - 1);

    return $candidates;
}

/**
 * True si $lower, o alguno de sus singulares posibles, esta prohibido.
 */
function Wo_ProfanityIsForbidden($lower, $words) {
    if (isset($words[$lower])) {
        return true;
    }
    foreach (Wo_ProfanitySingularCandidates($lower) as $candidate) {
        if ($candidate !== '' && isset($words[$candidate])) {
            return true;
        }
    }
    return false;
}

/**
 * Censors $text by replacing whole-word matches (Unicode-aware, case-insensitive)
 * of any known forbidden word with a partially-masked version (see
 * Wo_ProfanityMask()). Unlike the legacy str_replace approach in Wo_Secure(),
 * this does not match substrings inside unrelated words (e.g. "clase" no
 * longer gets mangled by a censored "as"). Same tokenizing regex as
 * dowdes.com/shomex.com.mx's ProfanityFilter::censor() for consistency.
 *
 * Tambien detecta el plural de cada palabra de la lista (ver
 * Wo_ProfanitySingularCandidates): antes "Casino" se censuraba pero "casinos"
 * pasaba limpio.
 */
function Wo_ProfanityFilter($text) {
    if ($text === null || $text === '') {
        return $text;
    }
    $words = Wo_ProfanityWordSet();
    if (empty($words)) {
        return $text;
    }
    $censored = preg_replace_callback('/\p{L}[\p{L}\p{N}\']*+/u', function ($m) use ($words) {
        $lower = mb_strtolower($m[0]);
        return Wo_ProfanityIsForbidden($lower, $words)
            ? Wo_ProfanityMask($m[0])
            : $m[0];
    }, $text);
    return Wo_ProfanityCensorCjk($censored === null ? $text : $censored, $words);
}

/**
 * Palabras CJK puras (Han/Hiragana/Katakana/Hangul), de mas larga a mas
 * corta. El chino/japones/coreano no separan palabras con espacios, asi que
 * la coincidencia por palabra completa nunca dispararia: aqui se buscan
 * subcadenas. Es la excepcion deliberada a la regla de palabra completa.
 */
function Wo_ProfanityCjkWords($words) {
    static $cjk = null;
    if ($cjk !== null) {
        return $cjk;
    }
    $cjk = array();
    foreach (array_keys($words) as $word) {
        if (preg_match('/^[\p{Han}\p{Hiragana}\p{Katakana}\p{Hangul}]+$/u', $word)) {
            $cjk[] = $word;
        }
    }
    usort($cjk, function ($a, $b) {
        return mb_strlen($b) - mb_strlen($a);
    });
    return $cjk;
}

function Wo_ProfanityCensorCjk($text, $words) {
    foreach (Wo_ProfanityCjkWords($words) as $word) {
        if (mb_strpos($text, $word) !== false) {
            $text = str_replace($word, Wo_ProfanityMask($word), $text);
        }
    }
    return $text;
}

/**
 * Cuenta palabras prohibidas DISTINTAS en $text (para decidir bloqueo).
 * La censura (mask) sigue haciendola Wo_ProfanityFilter(); esto solo informa
 * cuantas hay, sin modificar el texto.
 */
function Wo_ProfanityCountHits($text) {
    if ($text === null || $text === '') {
        return 0;
    }
    $words = Wo_ProfanityWordSet();
    if (empty($words)) {
        return 0;
    }
    $hits = 0;
    $seen = array();
    if (preg_match_all('/\p{L}[\p{L}\p{N}\']*+/u', $text, $matches)) {
        foreach ($matches[0] as $token) {
            $lower = mb_strtolower($token);
            if (isset($seen[$lower])) {
                continue;
            }
            $seen[$lower] = true;
            if (Wo_ProfanityIsForbidden($lower, $words)) {
                $hits++;
            }
        }
    }
    foreach (Wo_ProfanityCjkWords($words) as $word) {
        if (mb_strpos($text, $word) !== false) {
            $hits++;
        }
    }
    return $hits;
}
