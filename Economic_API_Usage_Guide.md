# 📊 Economic API - Complete Usage Guide

## Base URL
```
http://localhost:5003
```

## 🔐 Authentication
Most endpoints are public (no auth required). For protected endpoints, include JWT token:
```
Authorization: Bearer <your-jwt-token>
```

---

## 📈 1. Economic Events API

### **Endpoint:** `GET /api/economic/events`

### **Use Cases:**
- Display upcoming economic events on dashboard
- Show event calendar in trading application
- Filter events by country/importance for specific regions
- Build economic calendar widget

### **Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `country` | string | No | - | Filter by country (e.g., "United States", "Euro Zone") |
| `importance` | string | No | - | Filter by importance ("High", "Medium", "Low") |
| `category` | string | No | - | Filter by category ("Monetary Policy", "Employment", "Inflation") |
| `fromDate` | datetime | No | - | Start date (ISO format: 2025-10-30T00:00:00Z) |
| `toDate` | datetime | No | - | End date (ISO format: 2025-11-30T23:59:59Z) |
| `page` | integer | No | 1 | Page number |
| `pageSize` | integer | No | 50 | Items per page |

### **Sample Requests:**
```bash
# Get all US high importance events
curl -X GET "http://localhost:5003/api/economic/events?country=United%20States&importance=High"

# Get monetary policy events in Euro Zone
curl -X GET "http://localhost:5003/api/economic/events?category=Monetary%20Policy&country=Euro%20Zone"

# Get events in date range
curl -X GET "http://localhost:5003/api/economic/events?fromDate=2025-11-01T00:00:00Z&toDate=2025-11-30T23:59:59Z"

# Get all events (paginated)
curl -X GET "http://localhost:5003/api/economic/events?page=1&pageSize=20"
```

### **Frontend Example (JavaScript):**
```javascript
// Get US Federal Reserve events
async function getUSEconomicEvents() {
    const response = await fetch('http://localhost:5003/api/economic/events?country=United%20States&importance=High');
    const data = await response.json();
    console.log(data.Data); // Array of events
    return data.Data;
}

// Display in HTML
function displayEvents(events) {
    const container = document.getElementById('events-container');
    container.innerHTML = events.map(event => `
        <div class="event-card">
            <h3>${event.Title}</h3>
            <p><strong>Date:</strong> ${new Date(event.EventTime).toLocaleString()}</p>
            <p><strong>Country:</strong> ${event.Country}</p>
            <p><strong>Importance:</strong> ${event.Importance}</p>
            <p><strong>Description:</strong> ${event.Description}</p>
        </div>
    `).join('');
}
```

---

## 📰 2. Economic News API

### **Endpoint:** `GET /api/economic/news`

### **Use Cases:**
- Display economic news feed
- Search news by keyword
- Filter news by category
- Build financial news dashboard

### **Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `searchTerm` | string | No | - | Full-text search term |
| `category` | string | No | - | Filter by category ("Monetary Policy", "Employment", "Inflation") |
| `language` | string | No | - | Language filter ("en", "es", "fr") |
| `page` | integer | No | 1 | Page number |
| `pageSize` | integer | No | 50 | Items per page |

### **Sample Requests:**
```bash
# Search for Federal Reserve news
curl -X GET "http://localhost:5003/api/economic/news?searchTerm=federal%20reserve"

# Get monetary policy news
curl -X GET "http://localhost:5003/api/economic/news?category=Monetary%20Policy"

# Get English news only
curl -X GET "http://localhost:5003/api/economic/news?language=en"

# Search and filter combined
curl -X GET "http://localhost:5003/api/economic/news?searchTerm=interest%20rate&category=Monetary%20Policy"
```

### **Frontend Example (JavaScript):**
```javascript
// Search economic news
async function searchEconomicNews(searchTerm, category = '') {
    let url = `http://localhost:5003/api/economic/news?searchTerm=${encodeURIComponent(searchTerm)}`;
    if (category) url += `&category=${category}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.Data;
}

// Display news feed
function displayNewsFeed(news) {
    const newsContainer = document.getElementById('news-feed');
    newsContainer.innerHTML = news.map(article => `
        <div class="news-article">
            <h3>${article.Subject}</h3>
            <p><strong>Category:</strong> ${article.Category}</p>
            <p><strong>Published:</strong> ${new Date(article.PublishedAt).toLocaleString()}</p>
            <p><strong>Source:</strong> ${article.Source}</p>
            <p>${article.Body}</p>
            ${article.Tags.length > 0 ? `<div class="tags">${article.Tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
        </div>
    `).join('');
}

// Usage
searchEconomicNews('inflation').then(displayNewsFeed);
```

---

## 📅 3. Economic Calendar API

### **Endpoint:** `GET /api/economic/calendar`

### **Use Cases:**
- Show economic calendar on trading platform
- Highlight important events for traders
- Display upcoming releases with forecast vs actual
- Build economic calendar widget

### **Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fromDate` | datetime | No | - | Start date (ISO format) |
| `toDate` | datetime | No | - | End date (ISO format) |
| `country` | string | No | - | Filter by country |
| `importance` | string | No | - | Filter by importance ("High", "Medium", "Low") |
| `page` | integer | No | 1 | Page number |
| `pageSize` | integer | No | 50 | Items per page |

### **Sample Requests:**
```bash
# Get calendar for next 30 days
curl -X GET "http://localhost:5003/api/economic/calendar?toDate=2025-11-30T23:59:59Z"

# Get high importance US events
curl -X GET "http://localhost:5003/api/economic/calendar?country=United%20States&importance=High"

# Get events in specific date range
curl -X GET "http://localhost:5003/api/economic/calendar?fromDate=2025-11-01T00:00:00Z&toDate=2025-11-15T23:59:59Z"
```

### **Frontend Example (JavaScript):**
```javascript
// Get economic calendar
async function getEconomicCalendar(startDate, endDate, country = '') {
    let url = `http://localhost:5003/api/economic/calendar?toDate=${endDate}`;
    if (startDate) url += `&fromDate=${startDate}`;
    if (country) url += `&country=${country}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.Data;
}

// Display calendar
function displayCalendar(calendarEvents) {
    const calendarContainer = document.getElementById('economic-calendar');
    
    // Group events by date
    const eventsByDate = calendarEvents.reduce((acc, event) => {
        const date = new Date(event.EventTime).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
    }, {});
    
    calendarContainer.innerHTML = Object.entries(eventsByDate).map(([date, events]) => `
        <div class="calendar-day">
            <h4>${date}</h4>
            ${events.map(event => `
                <div class="calendar-event ${event.Importance.toLowerCase()}">
                    <strong>${event.Title}</strong>
                    <p>${event.Time} - ${event.Description}</p>
                    ${event.Forecast ? `<p><strong>Forecast:</strong> ${event.Forecast}</p>` : ''}
                    ${event.Actual ? `<p><strong>Actual:</strong> ${event.Actual}</p>` : ''}
                    ${event.Previous ? `<p><strong>Previous:</strong> ${event.Previous}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('');
}

// Usage - Get next 7 days calendar
const today = new Date();
const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
getEconomicCalendar(today.toISOString(), nextWeek.toISOString()).then(displayCalendar);
```

---

## 📊 4. Economic Indicators API

### **Endpoint:** `GET /api/economic/indicators`

### **Use Cases:**
- Display current economic indicators
- Show trend charts for GDP, inflation, employment
- Compare actual vs forecast values
- Build economic dashboard

### **Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `indicator` | string | No | - | Specific indicator ("GDP", "CPI", "UNEMPLOYMENT_RATE", "INTEREST_RATE") |
| `country` | string | No | - | Filter by country/currency ("USD", "EUR", "GBP") |
| `period` | string | No | "monthly" | Time period ("monthly", "quarterly", "annual") |
| `fromDate` | datetime | No | - | Start date |
| `toDate` | datetime | No | - | End date |
| `page` | integer | No | 1 | Page number |
| `pageSize` | integer | No | 50 | Items per page |

### **Sample Requests:**
```bash
# Get all US indicators
curl -X GET "http://localhost:5003/api/economic/indicators?country=USD"

# Get specific indicator (Inflation)
curl -X GET "http://localhost:5003/api/economic/indicators?indicator=CPI&country=USD"

# Get quarterly GDP data
curl -X GET "http://localhost:5003/api/economic/indicators?indicator=GDP&period=quarterly"

# Get indicators for date range
curl -X GET "http://localhost:5003/api/economic/indicators?fromDate=2025-01-01T00:00:00Z&toDate=2025-12-31T23:59:59Z"
```

### **Frontend Example (JavaScript):**
```javascript
// Get economic indicators
async function getEconomicIndicators(country, indicator = '') {
    let url = `http://localhost:5003/api/economic/indicators?country=${country}`;
    if (indicator) url += `&indicator=${indicator}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.Data;
}

// Display indicators with trend visualization
function displayIndicators(indicators) {
    const container = document.getElementById('indicators-container');
    
    container.innerHTML = indicators.map(indicator => {
        const change = indicator.CurrentValue - indicator.PreviousValue;
        const changePercent = ((change / indicator.PreviousValue) * 100).toFixed(2);
        const trend = change > 0 ? '↗️' : change < 0 ? '↘️' : '➡️';
        
        return `
            <div class="indicator-card">
                <h3>${indicator.Name}</h3>
                <div class="value-display">
                    <span class="current-value">${indicator.CurrentValue}%</span>
                    <span class="trend ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}">
                        ${trend} ${changePercent}%
                    </span>
                </div>
                <div class="details">
                    <p><strong>Previous:</strong> ${indicator.PreviousValue}%</p>
                    <p><strong>Forecast:</strong> ${indicator.ForecastValue}%</p>
                    <p><strong>Unit:</strong> ${indicator.Unit}</p>
                    <p><strong>Last Updated:</strong> ${new Date(indicator.LastUpdate).toLocaleDateString()}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Usage
getEconomicIndicators('USD', 'CPI').then(displayIndicators);

// Chart integration with Chart.js
function createIndicatorChart(indicators) {
    const ctx = document.getElementById('indicatorChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: indicators.map(i => new Date(i.LastUpdate).toLocaleDateString()),
            datasets: [{
                label: 'Current Value',
                data: indicators.map(i => i.CurrentValue),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }, {
                label: 'Previous Value',
                data: indicators.map(i => i.PreviousValue),
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
```

---

## 📈 5. Economic Summary API

### **Endpoint:** `GET /api/economic/summary`

### **Use Cases:**
- Dashboard overview widget
- Economic health summary
- Quick market overview
- Executive summary page

### **Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `countries` | string | No | - | Comma-separated list of countries |
| `includeForecast` | boolean | No | true | Include forecast data |

### **Sample Requests:**
```bash
# Get complete economic summary
curl -X GET "http://localhost:5003/api/economic/summary"

# Get summary for specific countries
curl -X GET "http://localhost:5003/api/economic/summary?countries=United%20States,Euro%20Zone"

# Summary without forecasts
curl -X GET "http://localhost:5003/api/economic/summary?includeForecast=false"
```

### **Frontend Example (JavaScript):**
```javascript
// Get economic summary
async function getEconomicSummary(countries = '', includeForecast = true) {
    let url = 'http://localhost:5003/api/economic/summary';
    const params = new URLSearchParams();
    
    if (countries) params.append('countries', countries);
    if (!includeForecast) params.append('includeForecast', 'false');
    
    if (params.toString()) url += '?' + params.toString();
    
    const response = await fetch(url);
    const data = await response.json();
    return data;
}

// Display summary dashboard
function displayEconomicSummary(summary) {
    const container = document.getElementById('economic-summary');
    
    container.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card">
                <h3>📊 Total Events</h3>
                <div class="metric">${summary.TotalEvents}</div>
                <div class="breakdown">
                    <span class="high">High: ${summary.EventsByImportance.High}</span>
                    <span class="medium">Medium: ${summary.EventsByImportance.Medium}</span>
                    <span class="low">Low: ${summary.EventsByImportance.Low}</span>
                </div>
            </div>
            
            <div class="summary-card">
                <h3>📰 News Count</h3>
                <div class="metric">${summary.NewsCount}</div>
            </div>
            
            <div class="summary-card">
                <h3>🌍 Top Countries</h3>
                <div class="country-list">
                    ${summary.TopCountries.map(country => `<span class="country-tag">${country}</span>`).join('')}
                </div>
            </div>
            
            <div class="summary-card">
                <h3>💱 Top Currencies</h3>
                <div class="currency-list">
                    ${summary.TopCurrencies.map(currency => `<span class="currency-tag">${currency}</span>`).join('')}
                </div>
            </div>
        </div>
        
        <div class="categories-breakdown">
            <h4>Events by Category</h4>
            <div class="category-grid">
                ${Object.entries(summary.EventsByCategory).map(([category, count]) => `
                    <div class="category-item">
                        <span class="category-name">${category}</span>
                        <span class="category-count">${count}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="last-update">
            <small>Last updated: ${new Date(summary.LastUpdate).toLocaleString()}</small>
        </div>
    `;
}

// Auto-refresh summary every 5 minutes
function startSummaryAutoRefresh() {
    getEconomicSummary().then(displayEconomicSummary);
    setInterval(() => {
        getEconomicSummary().then(displayEconomicSummary);
    }, 5 * 60 * 1000);
}

// Usage
getEconomicSummary().then(displayEconomicSummary);
```

---

## 🎯 6. Market Impact Analysis API

### **Endpoint:** `GET /api/economic/impact/{id}`

### **Use Cases:**
- Show potential market impact of events
- Risk assessment for traders
- Volatility predictions
- Trading strategy planning

### **Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | Yes | Event ID from economic events |

### **Sample Requests:**
```bash
# Get impact analysis for event ID 1
curl -X GET "http://localhost:5003/api/economic/impact/1"

# Get impact for multiple events (make multiple calls)
curl -X GET "http://localhost:5003/api/economic/impact/1"
curl -X GET "http://localhost:5003/api/economic/impact/2"
```

### **Frontend Example (JavaScript):**
```javascript
// Get market impact analysis
async function getMarketImpact(eventId) {
    const response = await fetch(`http://localhost:5003/api/economic/impact/${eventId}`);
    const data = await response.json();
    return data;
}

// Display impact analysis
function displayMarketImpact(impact) {
    const container = document.getElementById('market-impact');
    
    const getImpactColor = (value) => {
        if (value >= 0.7) return 'high-impact';
        if (value >= 0.4) return 'medium-impact';
        return 'low-impact';
    };
    
    container.innerHTML = `
        <div class="impact-header">
            <h3>${impact.EventTitle}</h3>
            <p class="event-time">Event Time: ${new Date(impact.EventTime).toLocaleString()}</p>
            <div class="volatility-forecast">
                <strong>Volatility Forecast: </strong>
                <span class="volatility-level ${getImpactColor(impact.VolatilityForecast)}">
                    ${(impact.VolatilityForecast * 100).toFixed(0)}%
                </span>
            </div>
        </div>
        
        <div class="impact-sections">
            <div class="impact-section">
                <h4>💱 Currency Impact</h4>
                <div class="impact-grid">
                    ${Object.entries(impact.CurrencyImpact).map(([pair, value]) => `
                        <div class="impact-item ${getImpactColor(value)}">
                            <span class="pair">${pair}</span>
                            <span class="impact-value">${(value * 100).toFixed(0)}%</span>
                            <div class="impact-bar">
                                <div class="impact-fill" style="width: ${value * 100}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="impact-section">
                <h4>📈 Stock Index Impact</h4>
                <div class="impact-grid">
                    ${Object.entries(impact.StockIndexImpact).map(([index, value]) => `
                        <div class="impact-item ${getImpactColor(value)}">
                            <span class="pair">${index}</span>
                            <span class="impact-value">${(value * 100).toFixed(0)}%</span>
                            <div class="impact-bar">
                                <div class="impact-fill" style="width: ${value * 100}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="impact-section">
                <h4>🥇 Commodity Impact</h4>
                <div class="impact-grid">
                    ${Object.entries(impact.CommodityImpact).map(([commodity, value]) => `
                        <div class="impact-item ${getImpactColor(value)}">
                            <span class="pair">${commodity}</span>
                            <span class="impact-value">${(value * 100).toFixed(0)}%</span>
                            <div class="impact-bar">
                                <div class="impact-fill" style="width: ${value * 100}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="affected-symbols">
            <h4>🎯 Affected Symbols</h4>
            <div class="symbols-list">
                ${impact.AffectedSymbols.map(symbol => `<span class="symbol-tag">${symbol}</span>`).join('')}
            </div>
        </div>
        
        <div class="analysis">
            <h4>📋 Analysis</h4>
            <p>${impact.Analysis}</p>
        </div>
    `;
}

// Usage with event selection
function onEventSelect(eventId) {
    getMarketImpact(eventId).then(displayMarketImpact);
}

// Compare multiple events
async function compareEventImpacts(eventIds) {
    const impacts = await Promise.all(eventIds.map(id => getMarketImpact(id)));
    
    const comparisonContainer = document.getElementById('impact-comparison');
    comparisonContainer.innerHTML = impacts.map((impact, index) => `
        <div class="impact-comparison-card">
            <h4>Event ${index + 1}: ${impact.EventTitle}</h4>
            <div class="volatility-comparison">
                Volatility: ${(impact.VolatilityForecast * 100).toFixed(0)}%
            </div>
            <div class="top-affected">
                Top 3 Affected: ${impact.AffectedSymbols.slice(0, 3).join(', ')}
            </div>
        </div>
    `).join('');
}
```

---

## 🔧 7. Data Sources API

### **Endpoint:** `GET /api/economic/data-sources`

### **Use Cases:**
- Monitor data source status
- Check data freshness
- System administration
- API health monitoring

### **Parameters:**
None (no parameters required)

### **Sample Requests:**
```bash
# Get all data sources
curl -X GET "http://localhost:5003/api/economic/data-sources"
```

### **Frontend Example (JavaScript):**
```javascript
// Get data sources
async function getDataSources() {
    const response = await fetch('http://localhost:5003/api/economic/data-sources');
    const data = await response.json();
    return data;
}

// Display data source status
function displayDataSources(sources) {
    const container = document.getElementById('data-sources');
    
    container.innerHTML = sources.map(source => {
        const statusColor = source.IsActive ? 'active' : 'inactive';
        const timeSinceUpdate = Math.floor((new Date() - new Date(source.LastUpdate)) / (1000 * 60));
        
        return `
            <div class="data-source-card ${statusColor}">
                <div class="source-header">
                    <h4>${source.Name}</h4>
                    <span class="status-badge ${statusColor}">
                        ${source.IsActive ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                </div>
                <div class="source-details">
                    <p><strong>Type:</strong> ${source.Type}</p>
                    <p><strong>Endpoint:</strong> ${source.Endpoint}</p>
                    <p><strong>Update Frequency:</strong> ${source.UpdateFrequency} minutes</p>
                    <p><strong>Last Update:</strong> ${timeSinceUpdate} minutes ago</p>
                    ${source.ApiKey ? '<p><strong>API Key:</strong> Configured</p>' : '<p><strong>API Key:</strong> Not configured</p>'}
                </div>
            </div>
        `;
    }).join('');
}

// Monitor data source health
function startDataSourceMonitoring() {
    getDataSources().then(displayDataSources);
    
    // Refresh every 2 minutes
    setInterval(() => {
        getDataSources().then(displayDataSources);
    }, 2 * 60 * 1000);
}

// Check if all sources are active
function checkDataSourceHealth(sources) {
    const activeSources = sources.filter(source => source.IsActive).length;
    const totalSources = sources.length;
    
    if (activeSources === totalSources) {
        showNotification('All data sources are healthy', 'success');
    } else {
        showNotification(`${totalSources - activeSources} data sources are down`, 'warning');
    }
}

// Usage
getDataSources().then(sources => {
    displayDataSources(sources);
    checkDataSourceHealth(sources);
});
```

---

## 🔄 8. Refresh Data API

### **Endpoint:** `POST /api/economic/refresh`

### **Use Cases:**
- Manually refresh economic data
- Force update before important events
- System administration
- Data synchronization

### **Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataTypes` | array | No | Types to refresh ["events", "news", "calendar", "indicators"] |
| `countries` | array | No | Countries to refresh |
| `fromDate` | datetime | No | Start date for refresh |
| `toDate` | datetime | No | End date for refresh |
| `forceUpdate` | boolean | No | Force update even if recently updated |

### **Sample Requests:**
```bash
# Refresh all data
curl -X POST "http://localhost:5003/api/economic/refresh" \
  -H "Content-Type: application/json" \
  -d "{}"

# Refresh only events and news
curl -X POST "http://localhost:5003/api/economic/refresh" \
  -H "Content-Type: application/json" \
  -d '{"dataTypes": ["events", "news"]}'

# Refresh for specific countries
curl -X POST "http://localhost:5003/api/economic/refresh" \
  -H "Content-Type: application/json" \
  -d '{"countries": ["United States", "Euro Zone"]}'

# Force refresh specific date range
curl -X POST "http://localhost:5003/api/economic/refresh" \
  -H "Content-Type: application/json" \
  -d '{"fromDate": "2025-11-01T00:00:00Z", "toDate": "2025-11-30T23:59:59Z", "forceUpdate": true}'
```

### **Frontend Example (JavaScript):**
```javascript
// Refresh economic data
async function refreshEconomicData(options = {}) {
    const response = await fetch('http://localhost:5003/api/economic/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(options)
    });
    
    const data = await response.json();
    return data;
}

// Display refresh progress
function showRefreshProgress() {
    const modal = document.createElement('div');
    modal.className = 'refresh-modal';
    modal.innerHTML = `
        <div class="refresh-content">
            <h3>🔄 Refreshing Economic Data</h3>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <p class="progress-text">Initializing refresh...</p>
        </div>
    `;
    document.body.appendChild(modal);
    
    return modal;
}

// Update progress
function updateRefreshProgress(modal, progress, message) {
    const progressFill = modal.querySelector('.progress-fill');
    const progressText = modal.querySelector('.progress-text');
    
    progressFill.style.width = `${progress}%`;
    progressText.textContent = message;
}

// Complete refresh
function completeRefresh(modal, result) {
    modal.querySelector('.progress-text').textContent = 'Refresh completed successfully!';
    modal.querySelector('.progress-fill').style.width = '100%';
    
    setTimeout(() => {
        modal.remove();
        showNotification('Economic data refreshed successfully', 'success');
    }, 2000);
}

// Manual refresh trigger
async function triggerDataRefresh(options = {}) {
    const modal = showRefreshProgress();
    
    try {
        updateRefreshProgress(modal, 25, 'Connecting to data sources...');
        
        const result = await refreshEconomicData(options);
        
        updateRefreshProgress(modal, 75, 'Processing data...');
        
        updateRefreshProgress(modal, 90, 'Updating cache...');
        
        completeRefresh(modal, result);
        
        // Refresh current data display
        if (typeof refreshCurrentView === 'function') {
            refreshCurrentView();
        }
        
    } catch (error) {
        modal.querySelector('.progress-text').textContent = 'Refresh failed: ' + error.message;
        modal.querySelector('.progress-fill').style.backgroundColor = '#ff4757';
        
        setTimeout(() => modal.remove(), 3000);
    }
}

// Auto-refresh before high importance events
function setupAutoRefresh() {
    // Check for high importance events in next 24 hours
    fetch('http://localhost:5003/api/economic/events?importance=High')
        .then(response => response.json())
        .then(data => {
            const upcomingEvents = data.Data.filter(event => {
                const eventTime = new Date(event.EventTime);
                const now = new Date();
                const hoursUntilEvent = (eventTime - now) / (1000 * 60 * 60);
                return hoursUntilEvent > 0 && hoursUntilEvent < 24;
            });
            
            if (upcomingEvents.length > 0) {
                showNotification(`Auto-refresh scheduled for ${upcomingEvents.length} upcoming high-importance events`, 'info');
                
                // Schedule refresh 1 hour before first event
                const firstEvent = upcomingEvents.sort((a, b) => new Date(a.EventTime) - new Date(b.EventTime))[0];
                const refreshTime = new Date(new Date(firstEvent.EventTime) - 60 * 60 * 1000);
                const timeUntilRefresh = refreshTime - new Date();
                
                if (timeUntilRefresh > 0) {
                    setTimeout(() => {
                        triggerDataRefresh({ dataTypes: ['events', 'indicators'] });
                    }, timeUntilRefresh);
                }
            }
        });
}

// Usage
triggerDataRefresh(); // Refresh all data

// Or with options
triggerDataRefresh({
    dataTypes: ['events', 'news'],
    countries: ['United States'],
    forceUpdate: true
});

// Setup auto-refresh on page load
document.addEventListener('DOMContentLoaded', setupAutoRefresh);
```

---

## 🎨 CSS Styles for Frontend

### **Basic Styling:**
```css
/* Economic Events */
.economic-events-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    padding: 20px;
}

.event-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-left: 4px solid #007bff;
}

.event-card.high { border-left-color: #dc3545; }
.event-card.medium { border-left-color: #ffc107; }
.event-card.low { border-left-color: #28a745; }

/* Economic News */
.news-article {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    border-left: 4px solid #17a2b8;
}

.tags {
    margin-top: 8px;
}

.tag {
    background: #e9ecef;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-right: 8px;
}

/* Economic Indicators */
.indicator-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.value-display {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 12px 0;
}

.current-value {
    font-size: 24px;
    font-weight: bold;
    color: #007bff;
}

.trend.positive { color: #28a745; }
.trend.negative { color: #dc3545; }
.trend.neutral { color: #6c757d; }

/* Market Impact */
.impact-item {
    display: flex;
    align-items: center;
    padding: 8px;
    margin: 4px 0;
    border-radius: 4px;
}

.impact-item.high-impact { background: #ffe6e6; }
.impact-item.medium-impact { background: #fff3cd; }
.impact-item.low-impact { background: #d4edda; }

.impact-bar {
    flex: 1;
    height: 4px;
    background: #e9ecef;
    border-radius: 2px;
    margin-left: 8px;
}

.impact-fill {
    height: 100%;
    background: #007bff;
    border-radius: 2px;
    transition: width 0.3s ease;
}

/* Summary Dashboard */
.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.summary-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.metric {
    font-size: 32px;
    font-weight: bold;
    color: #007bff;
    margin: 12px 0;
}

/* Data Sources */
.data-source-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    border-left: 4px solid #28a745;
}

.data-source-card.inactive {
    border-left-color: #dc3545;
    opacity: 0.7;
}

.status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
}

.status-badge.active {
    background: #d4edda;
    color: #155724;
}

.status-badge.inactive {
    background: #f8d7da;
    color: #721c24;
}

/* Refresh Modal */
.refresh-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.refresh-content {
    background: white;
    border-radius: 8px;
    padding: 40px;
    text-align: center;
    max-width: 400px;
    width: 90%;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin: 20px 0;
}

.progress-fill {
    height: 100%;
    background: #007bff;
    width: 0%;
    transition: width 0.3s ease;
}

/* Responsive Design */
@media (max-width: 768px) {
    .economic-events-container,
    .summary-grid {
        grid-template-columns: 1fr;
    }
    
    .value-display {
        flex-direction: column;
        text-align: center;
    }
    
    .impact-grid {
        grid-template-columns: 1fr;
    }
}
```

---

## 🚀 Quick Start Guide

### **1. Basic Setup:**
```javascript
// API Base URL
const API_BASE = 'http://localhost:5003';

// Generic API call function
async function callAPI(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
    }
    return response.json();
}
```

### **2. Common Use Cases:**

**Dashboard Overview:**
```javascript
// Load all dashboard data
async function loadDashboard() {
    const [events, news, summary, indicators] = await Promise.all([
        callAPI('/api/economic/events?importance=High&pageSize=5'),
        callAPI('/api/economic/news?pageSize=5'),
        callAPI('/api/economic/summary'),
        callAPI('/api/economic/indicators?country=USD&pageSize=3')
    ]);
    
    displayEvents(events.Data);
    displayNews(news.Data);
    displaySummary(summary);
    displayIndicators(indicators.Data);
}
```

**Economic Calendar Widget:**
```javascript
function createEconomicCalendar() {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    
    callAPI(`/api/economic/calendar?toDate=${nextMonth.toISOString()}&importance=High`)
        .then(data => displayCalendar(data.Data))
        .catch(error => console.error('Calendar loading failed:', error));
}
```

**Real-time Impact Analysis:**
```javascript
function setupImpactMonitoring() {
    // Listen for event selections and show impact
    document.addEventListener('eventSelected', (event) => {
        const eventId = event.detail.id;
        getMarketImpact(eventId).then(displayMarketImpact);
    });
}
```

---

## 📱 Mobile Responsive Considerations

- Use `viewport` meta tag for mobile optimization
- Implement touch-friendly interface elements
- Consider reducing API call frequency on mobile devices
- Use skeleton loading for better perceived performance
- Implement offline caching for critical data

## 🔒 Security Considerations

- Implement rate limiting for API calls
- Add request validation on frontend
- Use HTTPS in production
- Implement proper error handling
- Sanitize user inputs before API calls

---

This guide provides everything needed to integrate the Economic API into any frontend application. Copy and adapt the code examples as needed for your specific use case!