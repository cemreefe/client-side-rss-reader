# Simple Client-Side RSS Reader

Live on https://rss-reader.dutl.uk/ !

A simple client-side RSS aggregator built with Vue.js. This application allows users to enter multiple RSS feed URLs, fetches and aggregates the feeds, sorts the posts by date, and displays the most recent posts first. It also allows users to bookmark the page with the current RSS feeds.

## Features

- Fetch multiple RSS feeds simultaneously.
- Display the aggregated posts sorted by date.
- Render HTML content of the posts.
- Display additional metadata (publication date, feed title) for each post.
- Save state on url &  a "Bookmark Me" button to bookmark the page with the current RSS feed URLs (compatibility varies)

## Usage

1. **Clone the repository**:
   ```sh
   git clone https://github.com/cemreefe/client-side-rss-reader.git
   cd client-side-rss-reader
   ```

2. **Open the `index.html` file in your browser**:
   ```sh
   open index.html
   ```

## How to Use

1. Enter the RSS feed URLs in the textarea, separated by commas.
2. Click the 🔄 button to fetch and display the feeds.
3. Click on ☾ to toggle dark mode.
4. Click on a post title to view its content. Click on the title again or use the "close"
   button at the end of the post to hide the content.
6. Click the "Bookmark Me" button to bookmark the page with the current feeds.
7. Click ⚙ to open advanced settings.
   1. Set a **cache TTL** to keep the posts in cache until next fetch.
   2. Use the **blocklist** to filter out content.
   3. This is a front-end tool, so connections are not great. Set a **truncation size** to early-kill
      every feed fetch request when a certain response size is hit. The higher this number is, the
      more posts you can fetch, and the more chance the request will timeout and return no feeds
      (improvements coming soon!).
   4. Use **kindle mode** to use this feed with your kindle. The kindle mode auto-adjusts the page location
      based on the post you're viewing and gives you handy buttons to traverse posts so that you won't
      have to scroll.
   5. Enable **mark-as-read** if you'd like to keep track of what you have or haven't read.
      Use with caution! This data is persisted on your browser, and it will go away if you clear browser cache.
      If your data is dear, don't forget to occasionally export your read list so you can import it if you lose your data.
      1. Hide posts marked as read, or don't. If you decide to keep them around, they are going to appear faded.
      2. Read posts list operations. Export, import or clear your read posts data.

## Example

Enter RSS feeds separated by a comma:

```plaintext
https://blog.jim-nielsen.com/feed.xml, https://manuelmoreale.com/feed/rss
```

You'll see that your url is now pointing to:

<https://rss-reader.dutl.uk/?feeds=https%3A%2F%2Fblog.jim-nielsen.com%2Ffeed.xml%2Chttps%3A%2F%2Fmanuelmoreale.com%2Ffeed%2Frss>

## Technical Details

- **Vue.js**: Used for reactive UI components and data binding.
- **Axios**: Used for making HTTP requests to fetch RSS feeds.
- **RSS Parser**: Used to parse the RSS feed XML into JSON format.
- **HTML5 and CSS3**: Used for structuring and styling the application.

## Additional info

Feel free to open a pull request if you see a technical improvement. For product improvements, please start a discussion in issues.
