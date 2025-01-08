function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}
function getCacheKey(url) {
  return `rss_cache_${btoa(url)}`;
}

function setCache(url, data) {
  const cacheKey = getCacheKey(url);
  const cachedData = {
    timestamp: Date.now(),
    data,
  };
  localStorage.setItem(cacheKey, JSON.stringify(cachedData));
}

function getCache(url, ttl) {
  const cacheKey = getCacheKey(url);
  const cachedData = localStorage.getItem(cacheKey);
  if (!cachedData) return null;

  const parsedData = JSON.parse(cachedData);
  if (Date.now() - parsedData.timestamp > ttl * 60 * 1000) {
    localStorage.removeItem(cacheKey);
    return null;
  }
  return parsedData.data;
}

new Vue({
  el: '#app',
  data: {
    rssInput: '',
    feeds: [],
    loading: false,
    error: null,
    currentPage: 1,
    pageSize: 10,
    cacheTTL: 30, // Default TTL in minutes
    blocklist: '', // Default blocklist
    advancedSettingsVisible: false,
  },
  computed: {
    paginatedFeeds() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.filteredFeeds.slice(start, start + this.pageSize);
    },
    filteredFeeds() {
      if (isBlank(this.blocklist)) {
        return this.sortedFeeds;
      }
      const blocks = this.blocklist.split(',').map(word => word.trim().toLowerCase());
      return this.sortedFeeds.filter(feed => {
        const content = `${feed.title} ${feed.content}`.toLowerCase();
        return !blocks.some(block => content.includes(block));
      });
    },
    sortedFeeds() {
      return this.feeds.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    },
    totalPages() {
      return Math.ceil(this.filteredFeeds.length / this.pageSize);
    },
  },
  methods: {
    async fetchFeeds() {
      this.loading = true;
      this.error = null;
      this.feeds = [];
      this.unfilteredFeeds = []; // Clear unfiltered results
      const parser = new RSSParser({
        customFields: {
          item: [
            ['media:content', 'mediaContent', {keepArray: true}],
          ]
        }
      });
      const urls = this.rssInput.split(',').map(url => url.trim());

      const fetchFeed = async (url) => {
        try {
          const cachedFeed = getCache(url, this.cacheTTL);
          if (cachedFeed) {
            console.log(`Using cached feed for ${url}`);
            this.unfilteredFeeds.push(...cachedFeed.items.map(item => ({
              title: item.title,
              link: item.link,
              pubDate: item.pubDate,
              content: item.content,
              feedTitle: cachedFeed.title,
              showDescription: false,
              mediaContent: item.mediaContent,
            })));
            console.log(this.unfilteredFeeds)
            this.updateFilteredFeeds(); // Update the filtered feeds whenever new data is added
            return;
          }

          const response = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
          const feed = await parser.parseString(response.data);
          setCache(url, feed);
          console.log("Feed");
          console.log(feed)

          this.unfilteredFeeds.push(...feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            content: item.content,
            feedTitle: feed.title,
            showDescription: false,
            mediaContent: item.mediaContent,
          })));
          console.log(this.unfilteredFeeds)
          this.updateFilteredFeeds(); // Update the filtered feeds as we go
        } catch (err) {
          console.error(`Failed to fetch feed from ${url}:`, err);
        }
      };

      // Fetch all feeds asynchronously but render progressively
      const feedPromises = urls.map(url => fetchFeed(url));

      // Wait for all feed fetches to finish
      await Promise.all(feedPromises);

      this.loading = false; // Set loading to false after all feeds have been processed
    },
    updateFilteredFeeds() {
      const blocks = isBlank(this.blocklist) ? [] : this.blocklist.split(',').map(word => word.trim().toLowerCase());
      this.feeds = this.unfilteredFeeds.filter(feed => {
        const content = `${feed.title} ${feed.content}`.toLowerCase();
        return !blocks.some(block => content.includes(block));
      });
    },
    showDescription(item) {
      this.feeds = this.feeds.map(feedItem => ({
        ...feedItem,
        showDescription: feedItem === item ? !feedItem.showDescription : feedItem.showDescription,
      }));
    },
    closeDescription(item) {
      item.showDescription = false;
    },
    formatDate(dateString) {
      const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    },
    loadFeedsFromQuery() {
      const urlParams = new URLSearchParams(window.location.search);
      const feeds = urlParams.get('feeds');
      if (feeds) {
        this.rssInput = feeds.split(',').join(', ');
        this.cacheTTL = Number(urlParams.get('ttl')) || this.cacheTTL;
        this.blocklist = urlParams.get('blocklist') || this.blocklist;
        this.fetchFeeds();
      }
    },
    invalidateCache() {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('rss_cache_')) {
          localStorage.removeItem(key);
        }
      });
      alert('Cache invalidated.');
    },
    toggleAdvancedSettings() {
      this.advancedSettingsVisible = !this.advancedSettingsVisible;
      document.getElementById('advanced-settings').style.display = this.advancedSettingsVisible ? 'block' : 'none';
    },
    updateUrlParams() {
      const queryParams = { feeds: this.rssInput.split(',').map(url => url.trim()), ttl: this.cacheTTL, blocklist: this.blocklist };
      const queryString = new URLSearchParams(queryParams).toString();
      history.replaceState(null, null, `?${queryString}`);
    },
  },
  mounted() {
    this.loadFeedsFromQuery();
  },
});