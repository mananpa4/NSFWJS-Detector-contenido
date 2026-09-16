-- ============================================================================
-- Chismy NSFW moderation: tabla de cola de revision + ajustes.
-- Importar en phpMyAdmin (cPanel) ANTES de subir los archivos del zip.
-- Idempotente: puede ejecutarse mas de una vez sin duplicar nada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `Wo_Chismy_Media_Moderation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL DEFAULT 0,
  `post_id` int(11) NOT NULL DEFAULT 0,
  `kind` varchar(16) NOT NULL DEFAULT 'post',
  `filename` varchar(255) NOT NULL DEFAULT '',
  `client_porn` decimal(5,4) NOT NULL DEFAULT 0,
  `client_sexy` decimal(5,4) NOT NULL DEFAULT 0,
  `client_verdict` varchar(16) NOT NULL DEFAULT 'unverified',
  `status` varchar(16) NOT NULL DEFAULT 'approved',
  `created_at` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `post_id` (`post_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

-- Wo_SaveConfig() solo hace UPDATE, nunca INSERT: estas claves deben
-- existir antes de que el admin-panel pueda guardarlas.
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_precheck_enabled', 'on');
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_block_score', '0.60');
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_review_score', '0.35');
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_text_block_hits', '3');
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_cdn_tfjs', 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_cdn_nsfwjs', 'https://cdn.jsdelivr.net/npm/nsfwjs');
INSERT IGNORE INTO `Wo_Config` (`name`, `value`) VALUES ('nsfw_api_url', '');
