import Blog from '../models/blogModel';

class BlogController {
  async createBlog(data: { title: string; content: string }) {
    try {
      const blog = new Blog({
        ...data,
        slug: data.title.toLowerCase().replace(/ /g, '-'),
        published: false,
      });

      return await blog.save();
    } catch (error) {
      console.log(error);
      return null;
    }
  }
}

export default BlogController;
