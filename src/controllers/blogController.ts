import { Elysia, t } from 'elysia';
import Blog from '../models/blogModel';
import jwt from '@elysiajs/jwt';

class BlogController {
  constructor(public data: string[] = ['Moonhalo']) {}
}

export const blog = new Elysia()
  .decorate('blogController', new BlogController())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
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
  );
