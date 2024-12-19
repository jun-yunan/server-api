import { Elysia, t } from 'elysia';
import jwt from '@elysiajs/jwt';
import User from '../models/userModel';
import bcrypt from 'bcrypt';
import cloudinary from 'cloudinary';
import fs from 'fs';
import https from 'https';

class AuthController {
  constructor(public data: string[] = ['Moonhalo']) {}
}

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const auth = new Elysia()
  .decorate('authController', new AuthController())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
  )
  .group('/api/auth', (app) =>
    app
      .get('/', () => 'Hello API')
      .get('/me', async ({ error, jwt, cookie: { auth } }) => {
        try {
          const identity = await jwt.verify(auth.value);

          if (!identity) {
            return error(401, 'Unauthorized');
          }

          const user = await User.findById(identity.id);
          if (!user) {
            return error(404, 'User not found');
          }
          return user.toJSON();
        } catch (err) {
          console.log(err);
          return error(500, "Something's wrong");
        }
      })
      .post(
        '/sign-up',
        async ({ body, error }) => {
          try {
            const { username, email, password } = body;
            if (!username || !email || !password) {
              return error(
                400,
                "Bad Request: Missing 'username', 'email' or 'password'",
              );
            }

            const existingUser = await User.findOne({ email });

            if (existingUser) {
              return error(400, 'Email already exists');
            }

            const hashPassword = await bcrypt.hash(password, 10);

            const user = await User.create({
              username,
              email,
              password: hashPassword,
            });

            if (!user) {
              return error(500, "Can't create user");
            }

            return {
              status: 'success',
              user,
            };
          } catch (err) {
            console.log(err);
            return error(500, "Something's wrong");
          }
        },
        {
          body: t.Object({
            username: t.String(),
            email: t.String(),
            password: t.String(),
          }),
        },
      )
      .post(
        '/sign-in',
        async ({ jwt, set, body, error, cookie: { auth } }) => {
          try {
            const { email, password } = body;

            if (!email || !password) {
              return error(400, 'Missing email or password');
            }

            const user = await User.findOne({ email });

            if (!user) {
              return error(400, 'User does not exist');
            }

            const correctPassword = await bcrypt.compare(
              password,
              user.password,
            );

            if (!correctPassword) {
              return error(400, 'Incorrect password');
            }

            auth.set({
              value: await jwt.sign({
                id: user._id.toString(),
                role: user.role,
                username: user.username,
                email: user.email,
              }),
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              // maxAge: 7 * 86400, //7 days
              maxAge: 4000,
              sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
              domain:
                process.env.NODE_ENV === 'production'
                  ? 'blog-travel-pearl.vercel.app'
                  : undefined,
              path: '/',
            });

            return {
              status: 'success',
              user,
              auth: auth.value,
            };
          } catch (err) {
            console.log(err);
            return error(500, 'Internal Server Error');
          }
        },
        {
          body: t.Object({
            email: t.String(),
            password: t.String(),
          }),
        },
      ),
  );
