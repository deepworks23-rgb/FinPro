import { attachErrorHandler, createApiApp } from '../apiApp';

const app = createApiApp();
attachErrorHandler(app);

export default app;
