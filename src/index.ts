import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import connect from './libs/db';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { upload } from './utils/uploadImage';
import { blog } from './controllers/blogController';
import { user } from './controllers/userController';
import { auth } from './controllers/authController';
import { comment } from './controllers/commentController';
import { like } from './controllers/likeController';
import https from 'https';
import fs from 'fs';

const port = process.env.PORT || 4000;

connect();
const app = new Elysia({})
  .use(swagger())
  .use(
    cors({
      origin: 'https://blog-travel-pearl.vercel.app',
    }),
  )
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
  .use(comment)
  .use(like)
  .listen(port);

// https
//   .createServer(
//     {
//       key: fs.readFileSync('blog-travel-pearl.vercel.app+2-key.pem'),
//       cert: fs.readFileSync('blog-travel-pearl.vercel.app+2.pem'),
//     },
//     app,
//   )
//   .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

console.log(`server is running at env ${process.env.NODE_ENV}`);
