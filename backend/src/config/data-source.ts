import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

// En desarrollo (ts-node) carga .ts; compilado (dist) carga .js
const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [`${__dirname}/../**/*.entity.${ext}`],
  migrations: [`${__dirname}/../database/migrations/*.${ext}`],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
