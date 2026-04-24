import 'reflect-metadata';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { createServer, type Server } from 'http';
import { AppDataSource } from './data-source';
import { env } from './getenv';
import { NotFoundError } from './errors';
import { errorMiddleware } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { roleMiddleware } from './middleware/role.middleware';
import { ROLE } from './constant';

const app = express();

function createMissingHandler(routeName: string): RequestHandler {
  return (_req, _res, next) => {
    next(new NotFoundError(`${routeName} handler is not available yet`));
  };
}

function loadHandler(modulePath: string, exportName: string, routeName: string): RequestHandler {
  try {
    const loadedModule = require(modulePath) as Record<string, unknown>;
    const handler = loadedModule[exportName];
    if (typeof handler === 'function') {
      return handler as RequestHandler;
    }
  } catch (_error) {
    // Safe fallback until the feature handler file exists.
  }

  return createMissingHandler(routeName);
}

const loginHandler = loadHandler('./endpoints/auth/login', 'loginHandler', 'POST /auth/login');
const logoutHandler = loadHandler('./endpoints/auth/logout', 'logoutHandler', 'POST /auth/logout');
const meHandler = loadHandler('./endpoints/auth/me', 'meHandler', 'GET /auth/me');

const getSurveyFormHandler = loadHandler('./endpoints/survey/get-form', 'getSurveyFormHandler', 'GET /survey/form');
const submitSurveyHandler = loadHandler('./endpoints/survey/submit', 'submitSurveyHandler', 'POST /survey/submit');

const getMutuDashboardHandler = loadHandler(
  './endpoints/mutu/get-dashboard',
  'getMutuDashboardHandler',
  'GET /mutu/dashboard'
);
const getMutuInputFormHandler = loadHandler(
  './endpoints/mutu/get-input-form',
  'getMutuInputFormHandler',
  'GET /mutu/input-form'
);
const saveMutuInputHandler = loadHandler('./endpoints/mutu/save-input', 'saveMutuInputHandler', 'POST /mutu/save-input');
const downloadMutuRekapHandler = loadHandler(
  './endpoints/mutu/download-rekap',
  'downloadMutuRekapHandler',
  'GET /mutu/download-rekap'
);

const getIndikatorListHandler = loadHandler('./endpoints/indikator/get-list', 'getIndikatorListHandler', 'GET /indikator');
const createIndikatorHandler = loadHandler('./endpoints/indikator/create', 'createIndikatorHandler', 'POST /indikator');
const updateIndikatorHandler = loadHandler(
  './endpoints/indikator/update',
  'updateIndikatorHandler',
  'PUT /indikator/:idIndikator'
);
const deleteIndikatorHandler = loadHandler(
  './endpoints/indikator/delete',
  'deleteIndikatorHandler',
  'DELETE /indikator/:idIndikator'
);

const getDashboardHandler = loadHandler('./endpoints/dashboard/get-dashboard', 'getDashboardHandler', 'GET /dashboard');
const downloadRekapIndikatorHandler = loadHandler(
  './endpoints/dashboard/download-rekap',
  'downloadRekapIndikatorHandler',
  'GET /superadmin/download-rekap-indikator'
);

const getRuanganListHandler = loadHandler('./endpoints/ruangan/get-list', 'getRuanganListHandler', 'GET /ruangan');
const getKategoriListHandler = loadHandler('./endpoints/kategori/get-list', 'getKategoriListHandler', 'GET /kategori');

const getRuanganDashboardHandler = loadHandler(
  './endpoints/ruangan/get-dashboard',
  'getRuanganDashboardHandler',
  'GET /ruangan/dashboard'
);
const downloadRuanganRekapHandler = loadHandler(
  './endpoints/ruangan/download-rekap',
  'downloadRuanganRekapHandler',
  'GET /superadmin/ruangan/:id/download-rekap'
);
const getRuanganEditHandler = loadHandler('./endpoints/ruangan/get-edit', 'getRuanganEditHandler', 'GET /ruangan/:id/edit');
const assignRuanganHandler = loadHandler('./endpoints/ruangan/assign', 'assignRuanganHandler', 'POST /ruangan/assign');
const switchRuanganHandler = loadHandler('./endpoints/ruangan/switch', 'switchRuanganHandler', 'PATCH /ruangan/switch');
const deactivateRuanganHandler = loadHandler(
  './endpoints/ruangan/deactivate',
  'deactivateRuanganHandler',
  'PATCH /ruangan/deactivate'
);

const getSkmRekapHandler = loadHandler('./endpoints/skm/get-rekap', 'getSkmRekapHandler', 'GET /skm/rekap');
const getSkmHasilHandler = loadHandler('./endpoints/skm/get-hasil', 'getSkmHasilHandler', 'GET /skm/hasil');
const getSkmPertanyaanHandler = loadHandler(
  './endpoints/skm/get-pertanyaan',
  'getSkmPertanyaanHandler',
  'GET /skm/pertanyaan'
);
const syncSkmPertanyaanHandler = loadHandler(
  './endpoints/skm/sync-pertanyaan',
  'syncSkmPertanyaanHandler',
  'POST /skm/sync-pertanyaan'
);
const deleteSkmPertanyaanHandler = loadHandler(
  './endpoints/skm/delete-pertanyaan',
  'deleteSkmPertanyaanHandler',
  'DELETE /skm/pertanyaan/:idPertanyaan'
);
const downloadSkmRekapHandler = loadHandler(
  './endpoints/skm/download-rekap',
  'downloadSkmRekapHandler',
  'GET /skm/download-rekap'
);

export { app };

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.post('/auth/login', loginHandler);
app.post('/auth/logout', logoutHandler);
app.get('/auth/me', authMiddleware, meHandler);

// Survey form is intentionally public so patient-facing survey links do not require authentication.
app.get('/survey/form', getSurveyFormHandler);
app.post('/survey/submit', submitSurveyHandler);

app.get('/mutu/dashboard', authMiddleware, roleMiddleware(ROLE.SUPERADMIN), getMutuDashboardHandler);
app.get('/mutu/input-form', authMiddleware, roleMiddleware(ROLE.ADMIN), getMutuInputFormHandler);
app.post('/mutu/save-input', authMiddleware, roleMiddleware(ROLE.ADMIN), saveMutuInputHandler);
app.get('/mutu/download-rekap', authMiddleware, roleMiddleware(ROLE.ADMIN), downloadMutuRekapHandler);

app.get('/indikator', authMiddleware, roleMiddleware(ROLE.ADMIN), getIndikatorListHandler);
app.post('/indikator', authMiddleware, roleMiddleware(ROLE.ADMIN), createIndikatorHandler);
app.put('/indikator/:idIndikator', authMiddleware, roleMiddleware(ROLE.ADMIN), updateIndikatorHandler);
app.delete('/indikator/:idIndikator', authMiddleware, roleMiddleware(ROLE.ADMIN), deleteIndikatorHandler);

app.get('/dashboard', authMiddleware, getDashboardHandler);
app.get('/superadmin/download-rekap-indikator', authMiddleware, roleMiddleware(ROLE.SUPERADMIN), downloadRekapIndikatorHandler);

app.get('/ruangan', getRuanganListHandler);
app.get('/kategori', getKategoriListHandler);

app.get('/ruangan/:id/dashboard', authMiddleware, roleMiddleware(ROLE.ADMIN), getRuanganDashboardHandler);
app.get('/superadmin/ruangan/:id/download-rekap', authMiddleware, roleMiddleware(ROLE.SUPERADMIN), downloadRuanganRekapHandler);
app.get('/ruangan/:id/edit', authMiddleware, roleMiddleware(ROLE.ADMIN), getRuanganEditHandler);
app.post('/ruangan/assign', authMiddleware, roleMiddleware(ROLE.ADMIN), assignRuanganHandler);
app.patch('/ruangan/switch', authMiddleware, roleMiddleware(ROLE.ADMIN), switchRuanganHandler);
app.patch('/ruangan/deactivate', authMiddleware, roleMiddleware(ROLE.ADMIN), deactivateRuanganHandler);

app.get('/skm/rekap', authMiddleware, roleMiddleware(ROLE.ADMIN), getSkmRekapHandler);
app.get('/skm/hasil', authMiddleware, roleMiddleware(ROLE.ADMIN), getSkmHasilHandler);
app.get('/skm/pertanyaan', authMiddleware, roleMiddleware(ROLE.ADMIN), getSkmPertanyaanHandler);
app.post('/skm/sync-pertanyaan', authMiddleware, roleMiddleware(ROLE.ADMIN), syncSkmPertanyaanHandler);
app.delete('/skm/pertanyaan/:idPertanyaan', authMiddleware, roleMiddleware(ROLE.ADMIN), deleteSkmPertanyaanHandler);
app.get('/skm/download-rekap', authMiddleware, roleMiddleware(ROLE.ADMIN), downloadSkmRekapHandler);

app.use((_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});

app.use(errorMiddleware);

let serverInstance: Server | null = null;

export async function initializeApp(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

export async function startServer(): Promise<Server> {
  await initializeApp();

  if (serverInstance) {
    return serverInstance;
  }

  serverInstance = createServer(app).listen(env.APP_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running on port ${env.APP_PORT}`);
  });

  return serverInstance;
}

if (require.main === module) {
  void startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

export default app;
