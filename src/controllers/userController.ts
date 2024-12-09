import { Elysia, t } from 'elysia';
import jwt from '@elysiajs/jwt';
import User from '../models/userModel';
import fs from 'fs/promises';
import cloudinary from 'cloudinary';

class UserController {
  constructor(public data: string[] = ['Moonhalo']) {}
}

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const user = new Elysia()
  .decorate('userController', new UserController())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
  )
  .group('/api/users', (app) =>
    app
      .get(
        '/:userId',
        async ({ jwt, cookie: { auth }, error, params }) => {
          try {
            const { userId } = params;
            if (!userId) {
              return error(400, 'Missing userId');
            }
            const identity = await jwt.verify(auth.value);
            if (!identity) {
              return error(401, 'Unauthorized');
            }
            const user = await User.findById(userId);
            if (!user) {
              return error(404, 'User not found');
            }
            return user.toJSON();
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ userId: t.String() }),
        },
      )
      .get('/me', async ({ jwt, cookie: { auth }, error }) => {
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
        '/me/update-avatar',
        async ({ jwt, cookie: { auth }, error, request }) => {
          try {
            const data = await request.formData();
            const file: File | null = data.get('image') as unknown as File;

            if (!file || file.size === 0) {
              return error(400, 'Missing image');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const bytes = await file.arrayBuffer();
            const filePath = `${process.cwd()}/temp/${Date.now()}-${
              identity.id
            }-${file.name}`;
            await fs.writeFile(filePath, new Uint8Array(bytes));

            const upload = await cloudinary.v2.uploader.upload(filePath, {
              folder: 'avatars',
              use_filename: true,
            });

            if (!upload) {
              return error(500, 'Upload failed');
            }

            await fs.unlink(filePath);

            const user = await User.findByIdAndUpdate(
              identity.id,
              {
                imageUrl: upload.secure_url,
              },
              {
                new: true,
              },
            );

            if (!user) {
              return error(500, 'Update failed');
            }

            return { status: 'success', url: upload.secure_url, user };
          } catch (err) {
            console.log(err);
            return error(500, "Something's wrong");
          }
        },
      )
      .put(
        '/:userId',
        async ({ jwt, cookie: { auth }, error, params, body }) => {
          try {
            const { userId } = params;

            if (!userId) {
              return error(400, 'Missing userId');
            }

            const {
              bio,
              dateOfBirth,
              email,
              location,
              name,
              personalWebsite,
              username,
            } = body;

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const existingUser = await User.findById(userId);

            if (!existingUser) {
              return error(404, 'User not found');
            }

            const user = await User.findByIdAndUpdate(
              userId,
              {
                username,
                email,
                name,
                location,
                bio,
                personalWebsite,
                dateOfBirth,
              },
              {
                new: true,
              },
            );
            if (!user) {
              return error(500, 'Update failed');
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
          params: t.Object({ userId: t.String() }),
          body: t.Object({
            username: t.Optional(t.String()),
            email: t.Optional(t.String()),
            name: t.Optional(t.String()),
            location: t.Optional(t.String()),
            bio: t.Optional(t.String()),
            personalWebsite: t.Optional(t.String()),
            dateOfBirth: t.Optional(t.Date()),
          }),
        },
      ),
  );
