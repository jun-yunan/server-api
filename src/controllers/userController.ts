import { Elysia, t } from 'elysia';
import jwt from '@elysiajs/jwt';
import User from '../models/userModel';
import fs from 'fs/promises';
import cloudinary from 'cloudinary';
import bcrypt from 'bcrypt';
import Blog from '../models/blogModel';

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

            return { status: 'success', url: upload.secure_url, user, bytes };
          } catch (err) {
            console.log(err);
            return error(500, "Something's wrong");
          }
        },
      )
      .put(
        '/me/update-password',
        async ({ body, jwt, cookie: { auth }, error }) => {
          try {
            const { oldPassword, newPassword } = body;

            if (!oldPassword || !newPassword) {
              return error(400, 'Missing oldPassword or newPassword');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const user = await User.findById(identity.id);
            if (!user) {
              return error(404, 'User not found');
            }

            const correctPassword = await bcrypt.compare(
              oldPassword,
              user.password,
            );

            if (!correctPassword) {
              return error(401, 'Incorrect old password');
            }

            if (oldPassword === newPassword) {
              return error(
                400,
                'New password must be different from old password',
              );
            }

            const hashNewPassword = await bcrypt.hash(newPassword, 10);

            const updatedUser = await User.findByIdAndUpdate(
              identity.id,
              {
                password: hashNewPassword,
              },
              {
                new: true,
              },
            );

            if (!updatedUser) {
              return error(500, 'Update failed');
            }

            return { status: 'success', user: updatedUser };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          body: t.Object({
            oldPassword: t.String(),
            newPassword: t.String(),
          }),
        },
      )
      .get(
        '/check-username',
        async ({ jwt, query, error, cookie: { auth } }) => {
          try {
            const { userId, username } = query;
            if (!userId || !username) {
              return error(400, 'Missing userId or username');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const user = await User.findById(userId);

            if (!user) {
              return error(404, 'User not found');
            }

            const usernameExists = await User.findOne({ username });

            if (usernameExists && usernameExists.id !== userId) {
              return error(400, 'Username already exists');
            }

            return { status: 'success', query };
          } catch (err) {
            return error(500, "Something's wrong");
          }
        },
        {
          query: t.Object({
            username: t.String(),
            userId: t.String(),
          }),
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

            if (username) {
              const usernameExists = await User.findOne({ username });

              if (usernameExists && usernameExists.id !== userId) {
                return error(400, 'Username already exists');
              }
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
      )
      .get('/me/blogs', async ({ jwt, error, cookie: { auth } }) => {
        try {
          const identity = await jwt.verify(auth.value);

          if (!identity) {
            return error(401, 'Unauthorized');
          }

          const user = await User.findById(identity.id);

          if (!user) {
            return error(404, 'User not found');
          }

          const blogs = await Blog.find({ author: identity.id })
            .sort({ createdAt: -1 })
            .populate(
              'author',
              'email name username imageUrl createdAt bio personalWebsite _id',
            )
            .exec();

          if (!blogs || blogs.length === 0) {
            return error(404, 'Blogs not found');
          }

          return blogs;
        } catch (err) {
          console.log(err);
          return error(500, "Something's wrong");
        }
      })
      .get(
        '/blogs/:authorId',
        async ({ error, params }) => {
          try {
            const { authorId } = params;

            if (!authorId) {
              return error(400, 'Missing authorId');
            }

            const author = await User.findById(authorId);

            if (!author) {
              return error(404, 'Author not found');
            }

            const blogs = await Blog.find({ author: authorId })
              .sort({ createdAt: -1 })
              .populate(
                'author',
                'email name username imageUrl createdAt bio personalWebsite _id',
              )
              .exec();

            if (!blogs || blogs.length === 0) {
              return error(404, 'Blogs not found');
            }

            return blogs;
          } catch (err) {
            console.log(err);
            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ authorId: t.String() }),
        },
      ),
  );
