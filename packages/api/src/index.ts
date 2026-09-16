import express from 'express';
import { config } from './config/index.js';
import { buildDeps } from './deps.js';
import { moderateRouter } from './routes/moderate.js';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/', moderateRouter(buildDeps()));

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`api-moderacion en :${config.port} (store=${config.store} queue=${config.queue} img=${config.imageProvider})`);
});
