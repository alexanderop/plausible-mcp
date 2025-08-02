# Plausible Analytics MCP Server

A Model Context Protocol (MCP) server that provides access to the Plausible Analytics API for querying website statistics and analytics data.

## Features

- **Full Plausible API Support**: Query historical and real-time stats with filtering and dimensions
- **Multiple Query Tools**: 
  - `plausible_query`: Full-featured querying with filters and dimensions
  - `plausible_aggregate`: Simple aggregate stats
  - `plausible_breakdown`: Stats broken down by dimensions
  - `plausible_timeseries`: Time-based data for charts
- **Robust Error Handling**: Automatic retries, timeout support, and detailed error messages
- **Connection Testing**: Built-in health check on startup
- **Comprehensive Logging**: Debug, info, and error logging through MCP

## Prerequisites

- Node.js 16 or higher
- A Plausible Analytics account with API access
- Plausible API key (get from https://plausible.io/settings/api-keys)

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/plausible-mcp.git
cd plausible-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

### From NPM (when published)

```bash
npm install -g @your-org/mcp-plausible
```

## Configuration

### Environment Variables

Create a `.env` file in the project root (see `examples/.env.example`):

```bash
# Required
PLAUSIBLE_API_KEY=your-api-key-here

# Optional
PLAUSIBLE_API_URL=https://plausible.io  # For self-hosted instances
PLAUSIBLE_TIMEOUT=30000                 # Request timeout in ms
```

### VS Code Integration

For VS Code extensions that support MCP (like Cline), add to your settings:

```json
{
  "cline.mcpServers": {
    "plausible": {
      "command": "node",
      "args": ["/absolute/path/to/plausible-mcp/build/index.js"],
      "env": {
        "PLAUSIBLE_API_KEY": "${env:PLAUSIBLE_API_KEY}"
      }
    }
  }
}
```

See `examples/vscode-settings.json` for more configuration examples.

### Claude Desktop Integration

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "plausible": {
      "command": "node",
      "args": ["/absolute/path/to/plausible-mcp/build/index.js"],
      "env": {
        "PLAUSIBLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage

Once configured, the MCP server provides four main tools:

## Getting Started

This MCP server lets you query Plausible Analytics for any site you own, directly from VS Code, Claude Desktop, or any MCP-compatible client. You can:
- Get traffic, engagement, and conversion stats for your site
- Break down analytics by page, device, country, source, and more
- Run advanced filters and time-based queries
- Automate reporting and SEO analysis

### Quick Setup
1. Get your Plausible API key from https://plausible.io/settings/api-keys
2. Set up your `.env` file or VS Code/Claude config (see below)
3. Start the MCP server:
   ```bash
   node build/index.js
   ```
4. Connect with your MCP client and start querying!

## Example Queries

### Get traffic stats for your site
```json
{
  "site_id": "alexop.dev",
  "metrics": ["visitors", "pageviews", "bounce_rate"],
  "date_range": "30d"
}
```

### See top countries and devices
```json
{
  "site_id": "alexop.dev",
  "metrics": ["visitors"],
  "date_range": "30d",
  "dimensions": ["visit:country_name", "visit:device"]
}
```

### Analyze traffic sources and campaigns
```json
{
  "site_id": "alexop.dev",
  "metrics": ["visitors"],
  "date_range": "30d",
  "dimensions": ["visit:source", "visit:utm_campaign"]
}
```

### Get hourly traffic trends
```json
{
  "site_id": "alexop.dev",
  "metrics": ["pageviews"],
  "date_range": "7d",
  "dimensions": ["time:hour"]
}
```

### Conversion rate by source (if goals set)
```json
{
  "site_id": "alexop.dev",
  "metrics": ["conversion_rate"],
  "date_range": "30d",
  "dimensions": ["visit:source"]
}
```

### Scroll depth per page
```json
{
  "site_id": "alexop.dev",
  "metrics": ["scroll_depth"],
  "date_range": "30d",
  "dimensions": ["event:page"]
}
```

## What insights can you get?
- Top pages, landing and exit pages
- Device, browser, and OS breakdowns
- Geographic breakdowns (country, region, city)
- Traffic sources and UTM campaign performance
- Conversion rates and custom event tracking
- Scroll depth and time on page
- Hourly/daily/weekly/monthly traffic trends
- Advanced filters and segments

### 1. plausible_query
Full-featured querying with all Plausible API capabilities:

```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "pageviews", "bounce_rate"],
  "date_range": "7d",
  "filters": [
    ["is", "visit:country_name", ["United States", "Canada"]]
  ],
  "dimensions": ["visit:source"],
  "order_by": [["visitors", "desc"]],
  "pagination": { "limit": 10 }
}
```

### 2. plausible_aggregate
Simple aggregate stats without dimensions:

```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "pageviews"],
  "date_range": "month"
}
```

### 3. plausible_breakdown
Stats broken down by dimensions:

```json
{
  "site_id": "example.com",
  "metrics": ["visitors"],
  "date_range": "7d",
  "dimensions": ["visit:country_name", "visit:device"],
  "limit": 20
}
```

### 4. plausible_timeseries
Time-based data for charts:

```json
{
  "site_id": "example.com",
  "metrics": ["visitors", "pageviews"],
  "date_range": "30d",
  "interval": "time:day"
}
```

## API Reference

### Date Ranges
- Relative: `"day"`, `"7d"`, `"30d"`, `"month"`, `"6mo"`, `"12mo"`, `"year"`, `"all"`
- Custom: `["2024-01-01", "2024-01-31"]` (ISO 8601 format)

### Metrics
- **Traffic**: `visitors`, `visits`, `pageviews`, `views_per_visit`
- **Engagement**: `bounce_rate`, `visit_duration`, `scroll_depth`
- **Events**: `events`, `conversion_rate`, `group_conversion_rate`
- **Revenue**: `average_revenue`, `total_revenue`
- **Other**: `percentage`, `time_on_page`

### Dimensions

#### Visit Dimensions
- `visit:source` - Traffic source
- `visit:referrer` - Referrer URL
- `visit:utm_medium` - UTM medium
- `visit:utm_source` - UTM source
- `visit:utm_campaign` - UTM campaign
- `visit:utm_content` - UTM content
- `visit:utm_term` - UTM term
- `visit:device` - Device type
- `visit:browser` - Browser name
- `visit:browser_version` - Browser version
- `visit:os` - Operating system
- `visit:os_version` - OS version
- `visit:country` - Country code
- `visit:country_name` - Country name
- `visit:region` - Region code
- `visit:region_name` - Region name
- `visit:city` - City code
- `visit:city_name` - City name

#### Event Dimensions
- `event:page` - Page path
- `event:hostname` - Hostname
- `event:goal` - Goal name
- `event:props:*` - Custom properties

#### Time Dimensions
- `time` - Auto-detected
- `time:hour` - Hourly
- `time:day` - Daily
- `time:week` - Weekly
- `time:month` - Monthly

### Filters

#### Simple Filters
```json
["is", "visit:country", ["US", "CA"]]
["contains", "event:page", ["/blog/"]]
["matches", "visit:source", ["google.*"]]
```

#### Logical Filters
```json
["and", [
  ["is", "visit:device", ["Mobile"]],
  ["is", "visit:country", ["US"]]
]]

["or", [
  ["is", "visit:source", ["google"]],
  ["is", "visit:source", ["bing"]]
]]

["not", ["is", "visit:country", ["US"]]]
```

#### Behavioral Filters
```json
["has_done", ["is", "event:goal", ["Signup"]]]
["has_not_done", ["is", "event:goal", ["Purchase"]]]
```

## Advanced Features

### Error Handling
- **Automatic Retries**: Failed requests are retried up to 3 times with exponential backoff
- **Rate Limit Handling**: Respects `Retry-After` headers from Plausible API
- **Timeout Support**: Configurable request timeout (default 30s)
- **Detailed Error Messages**: Clear error messages with context

### Logging
The server logs important events:
- Connection status on startup
- Tool invocations with parameters
- Success/failure of queries
- Detailed error information

To view logs:
- **Claude Desktop**: `tail -f ~/Library/Logs/Claude/mcp*.log` (macOS)
- **VS Code**: Check extension output panel

## Development

```bash
# Install dependencies
npm install

# Run TypeScript compiler in watch mode
npm run build -- --watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run typecheck
```

## Troubleshooting

### Connection Issues
1. Check if API key is set correctly
2. Verify network connectivity
3. For self-hosted instances, ensure `PLAUSIBLE_API_URL` is correct
4. Check logs for detailed error messages

### Rate Limiting
- Default limit: 600 requests/hour
- Server automatically retries with backoff
- Check `Retry-After` header in logs

### Common Errors
- **"Authentication failed"**: Invalid API key
- **"Not found"**: Site doesn't exist or you don't have access
- **"Bad request"**: Check query parameters format

## Security

- Never commit API keys to version control
- Use environment variables for sensitive data
- Consider using secret management tools for production
- All inputs are validated before sending to API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT - See LICENSE file for details

## Support

- **Plausible API Docs**: https://plausible.io/docs/stats-api
- **MCP Documentation**: https://modelcontextprotocol.io
- **Issues**: https://github.com/yourusername/plausible-mcp/issues

## Changelog

### 1.0.0
- Initial release with full Plausible Stats API support
- Four specialized tools for different query types
- Robust error handling and retry logic
- Comprehensive logging through MCP
- Connection health check on startup