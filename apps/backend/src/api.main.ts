import { ApiModule } from './api.module';
import { startHttpApp } from './bootstrap';

void startHttpApp(ApiModule, 'API');
