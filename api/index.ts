import { attachErrorHandler, createApiApp } from '../apiApp.js';

const app = createApiApp();
attachErrorHandler(app);

export default app;
