import { Elysia, error, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import connect from './libs/db';
import { cors } from '@elysiajs/cors';
import BlogController from './controllers/blogController';
import bcrypt from 'bcrypt';
import User from './models/userModel';
import { jwt } from '@elysiajs/jwt';
import Blog from './models/blogModel';

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
  .decorate('blogController', new BlogController())

  .get('/', () => 'Hello Elysia')
  .group('/blogs', (app) =>
    app
      .get('/', () => {
        return {
          blogs: [],
        };
      })
      .post(
        '/create-blog',
        async ({ body, blogController, error }) => {
          const { title, content } = body;
          if (!title || !content) {
            return error(400);
          }
          const blog = await blogController.createBlog(body);
          if (!blog) {
            return error(500);
          }
          return {
            status: 'success',
            body,
            blog,
          };
        },
        { body: t.Object({ title: t.String(), content: t.String() }) },
      ),
  )
  .group('/users', (app) =>
    app.get(
      '/:userId',
      ({ params }) => {
        return {
          id: params.userId,
          name: 'John Doe',
        };
      },
      { params: t.Object({ userId: t.Numeric() }) },
    ),
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
            const { name, email, password } = body;
            if (!name || !email || !password) {
              return error(
                400,
                "Bad Request: Missing 'name', 'email' or 'password'",
              );
            }

            const hashPassword = await bcrypt.hash(password, 10);

            const existingUser = await User.findOne({ email });

            if (existingUser) {
              return error(400, 'Email already exists');
            }

            const user = await User.create({
              name,
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
            name: t.String(),
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
                name: user.name,
                email: user.email,
              }),
              httpOnly: true,
              // maxAge: 7 * 86400, //7 days
              maxAge: 3000,
              // sameSite: 'lax',
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
  )
  .group('/api/blogs', (app) =>
    app
      .get(
        '/:blogId',
        async ({ error, jwt, cookie: { auth }, params }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }

            const token = await jwt.verify(auth.value);
            if (!token) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findById(params.blogId);
            if (!blog) {
              return error(404, 'Blog not found');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .get('/', async ({ error, jwt, cookie: { auth } }) => {
        try {
          const token = await jwt.verify(auth.value);
          if (!token) {
            return error(401, 'Unauthorized');
          }
          const blogs = await Blog.find();
          return {
            status: 'success',
            blogs,
          };
        } catch (err) {
          console.log(err);

          return error(500, "Something's wrong");
        }
      })
      .post(
        '/',
        async ({ body, jwt, headers, error, set, cookie: { auth } }) => {
          try {
            const { title, author, content } = body;
            if (!title || !author || !content) {
              return error(400, 'Missing title, author or content');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.create({
              author,
              title,
              content,
              slug: title.toLowerCase().replace(/ /g, '-'),
              published: false,
            });

            if (!blog) {
              return error(500, "Can't create blog");
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          body: t.Object({
            title: t.String(),
            author: t.String(),
            content: t.String(),
          }),
        },
      )
      .delete(
        '/:blogId',
        async ({ error, jwt, params, cookie: { auth } }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findByIdAndDelete(params.blogId);

            if (!blog) {
              return error(404, 'Blog not found');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .put(
        '/:blogId',
        async ({ error, jwt, params, body, cookie: { auth } }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }
            if (!body) {
              return error(400, 'Missing body');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findByIdAndUpdate(
              params.blogId,
              {
                author: body.author,
                title: body.title,
                content: body.content,
                slug: body.title.toLowerCase().replace(/ /g, '-'),
              },
              {
                new: true,
              },
            );

            if (!blog) {
              return error(404, 'Update failed');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
          body: t.Object({
            title: t.String(),
            author: t.String(),
            content: t.String(),
          }),
        },
      ),
  )
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
