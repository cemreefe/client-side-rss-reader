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
   git clone https://github.com/cemreefe/client-side-rss-aggregator.git
   cd rss-aggregator
   ```

2. **Open the `index.html` file in your browser**:
   ```sh
   open index.html
   ```

## How to Use

1. Enter the RSS feed URLs in the textarea, separated by commas.
2. Click the "Fetch Feeds" button to fetch and display the feeds.
3. Click on a post title to view its content. Click "Close" to hide the content.
4. Click the "Bookmark Me" button to bookmark the page with the current feeds.

## Example

Enter RSS feeds separated by a comma:

```plaintext
https://example.com/feed1.xml, https://example.com/feed2.xml
```

## Technical Details

- **Vue.js**: Used for reactive UI components and data binding.
- **Axios**: Used for making HTTP requests to fetch RSS feeds.
- **RSS Parser**: Used to parse the RSS feed XML into JSON format.
- **HTML5 and CSS3**: Used for structuring and styling the application.

## Additional info

Made on a lazy afternoon, feel free to collaborate
