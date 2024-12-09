import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import connect from './libs/db';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { upload } from './utils/uploadImage';
import { blog } from './controllers/blogController';
import { user } from './controllers/userController';
import { auth } from './controllers/authController';

const port = process.env.PORT || 4000;

connect();
const app = new Elysia()
  .use(swagger())
  .use(cors())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
  )
  .decorate('upload', upload)
  .get('/', () => 'Hello Elysia')
  .use(user)
  .use(auth)
  .use(blog)
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
