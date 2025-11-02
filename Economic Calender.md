# 📊 MT5ManagerAPI - Economy API Documentation

## 🎯 Overview

The Economy API provides comprehensive economic data access within the MT5ManagerAPI ecosystem. This API delivers real-time and historical economic indicators, calendar events, interest rates, and market analysis to support trading decisions and economic research.

## 🔐 Authentication

### Manager Authentication
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "1112",
  "password": "Meta@5757",
  "server": "213.227.128.157",
  "port": 443
}
```

### Client Authentication
```bash
POST /api/client/ClientAuth/login
Content-Type: application/json

{
  "accountId": 19877102,
  "password": "Test@000"
}
```

**Response includes JWT token for API access:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2025-11-29T08:40:04Z",
  "tokenType": "Bearer"
}
```

## 📋 API Endpoints

### 1. 📅 Economic Calendar
**Endpoint:** `GET /api/economy/calendar`

**Description:** Get upcoming economic events and data releases

**Parameters:**
- `country` (optional): Filter by country (e.g., "United States", "Eurozone")
- `category` (optional): Filter by category (e.g., "Monetary Policy", "Employment")
- `importance` (optional): Filter by importance ("High", "Medium", "Low")
- `fromDate` (optional): Start date (ISO 8601 format)
- `toDate` (optional): End date (ISO 8601 format)
- `limit` (optional): Maximum number of events (default: 50)

**Example Requests:**
```bash
# Get all upcoming events
GET /api/economy/calendar

# Get US high-importance events
GET /api/economy/calendar?country=United%20States&importance=High

# Get events for next 7 days
GET /api/economy/calendar?fromDate=2025-10-30&toDate=2025-11-06
```

**Response:**
```json
[
  {
    "id": "be97ae6c-7f0b-4e9b-b8ab-eb5f29e86cf3",
    "title": "Federal Funds Rate Decision",
    "country": "United States",
    "indicator": "Federal Funds Rate",
    "category": "Monetary Policy",
    "eventTime": "2025-10-31T08:36:47.6380722Z",
    "publishTime": "2025-10-31T10:36:47.6381041Z",
    "currency": "USD",
    "importance": "High",
    "actual": null,
    "forecast": "5.25%",
    "previous": "5.25%",
    "unit": "%",
    "description": "Federal Open Market Committee interest rate decision",
    "source": "Federal Reserve",
    "isTentative": false,
    "isRevised": false
  }
]
```

**Frontend Usage:**
- Display upcoming economic events in calendar view
- Filter events by country, importance, or date range
- Show event impact on currency pairs
- Alert users about high-impact events

---

### 2. 📈 Economic Indicators
**Endpoint:** `GET /api/economy/indicators`

**Description:** Get economic indicators by country

**Parameters:**
- `country` (optional): Country name (e.g., "United States", "Germany")
- `category` (optional): Category filter ("GDP", "Inflation", "Employment")
- `limit` (optional): Maximum results (default: 20)

**Example Requests:**
```bash
# Get all US economic indicators
GET /api/economy/indicators?country=United%20States

# Get inflation indicators
GET /api/economy/indicators?category=Inflation
```

**Response:**
```json
[
  {
    "id": "21b29d44-13f9-42c8-a56e-4b4c48a06ae8",
    "name": "GDP Growth Rate",
    "country": "United States",
    "currency": "USD",
    "category": "Economic Growth",
    "subcategory": "Quarterly GDP",
    "unit": "%",
    "frequency": "Quarterly",
    "currentValue": "2.1",
    "lastUpdate": null,
    "dataSource": "Bureau of Economic Analysis",
    "isImportant": true
  }
]
```

**Frontend Usage:**
- Display economic health indicators
- Compare countries' economic performance
- Show trend charts for key indicators
- Use in fundamental analysis tools

---

### 3. 🏦 Interest Rates
**Endpoint:** `GET /api/economy/interest-rates`

**Description:** Get central bank interest rates

**Parameters:**
- `country` (optional): Country filter
- `bank` (optional): Central bank name
- `limit` (optional): Maximum results (default: 20)

**Example Requests:**
```bash
# Get all interest rates
GET /api/economy/interest-rates

# Get Federal Reserve rates
GET /api/economy/interest-rates?bank=Federal%20Reserve
```

**Response:**
```json
[
  {
    "id": "7a9e08ec-34d9-48ca-92a3-545aa9830436",
    "bankName": "Federal Reserve",
    "country": "United States",
    "currency": "USD",
    "rateType": "Federal Funds Rate",
    "currentRate": 5.25,
    "lastChangeDate": "2025-09-30T08:36:47.6387424Z",
    "previousRate": 5.25,
    "rateDirection": "Neutral",
    "nextMeetingDate": "2025-12-14",
    "rateStatement": null,
    "forecast": null,
    "source": "Federal Reserve",
    "updatedAt": "2025-10-30T08:36:47.6386518Z"
  }
]
```

**Frontend Usage:**
- Display current interest rates
- Show rate change history
- Predict market reactions to rate decisions
- Interest rate differential analysis

---

### 4. 📰 Economic News
**Endpoint:** `GET /api/economy/news`

**Description:** Get economic news and analysis

**Parameters:**
- `country` (optional): Country filter
- `category` (optional): News category
- `limit` (optional): Maximum results (default: 20)
- `fromDate` (optional): Start date
- `toDate` (optional): End date

**Example Requests:**
```bash
# Get latest economic news
GET /api/economy/news

# Get US economic news
GET /api/economy/news?country=United%20States
```

**Response:**
```json
[
  {
    "id": "c3ef6a58-9d95-49ed-bbcd-3bf49cad02a2",
    "title": "Fed Holds Rates Steady, Signals Future Cuts Possible",
    "summary": "The Federal Reserve maintained its key interest rate at 5.25% but indicated that rate cuts may be appropriate later this year.",
    "content": "",
    "category": "Monetary Policy",
    "tags": ["Federal Reserve", "Interest Rates", "Monetary Policy"],
    "source": "Reuters",
    "author": "Economic Desk",
    "publishedAt": "2025-10-30T06:36:47.6406183Z",
    "createdAt": "2025-10-30T08:36:47.640517Z",
    "imageUrl": null,
    "url": null,
    "isBreaking": true,
    "language": "en"
  }
]
```

**Frontend Usage:**
- Display economic news feed
- Filter news by country or category
- Show breaking news alerts
- Integrate with trading terminals

---

### 5. 📊 Economic Dashboard
**Endpoint:** `GET /api/economy/dashboard/{country}`

**Description:** Get comprehensive economic overview for a country

**Parameters:**
- `country` (path): Country name (required)

**Example Requests:**
```bash
# Get US economic dashboard
GET /api/economy/dashboard/United%20States

# Get Eurozone dashboard
GET /api/economy/dashboard/Eurozone
```

**Response:**
```json
{
  "country": "United States",
  "interestRates": [
    {
      "bankName": "Federal Reserve",
      "currentRate": 5.25,
      "lastChangeDate": "2025-09-30T08:36:47.6387424Z",
      "nextMeetingDate": "2025-12-14"
    }
  ],
  "upcomingEvents": [
    {
      "title": "Federal Funds Rate Decision",
      "eventTime": "2025-10-31T08:36:47.6380722Z",
      "importance": "High",
      "forecast": "5.25%"
    }
  ],
  "latestNews": [
    {
      "title": "Fed Holds Rates Steady, Signals Future Cuts Possible",
      "publishedAt": "2025-10-30T06:36:47.6406183Z",
      "isBreaking": true
    }
  ],
  "keyIndicators": {
    "interestRate": "5.25%",
    "gdpGrowth": "2.1%",
    "inflation": "3.4%",
    "unemployment": "3.7%"
  },
  "lastUpdate": "2025-10-30T08:37:22.1124349Z"
}
```

**Frontend Usage:**
- Country economic overview pages
- Dashboard widgets showing key metrics
- Economic health monitoring
- Comparative country analysis

---

### 6. 🔔 Economic Alerts
**Endpoint:** `GET /api/economy/alerts`

**Description:** Get economic event alerts and notifications

**Parameters:**
- `userId` (optional): User ID for personalized alerts
- `active` (optional): Filter active alerts (true/false)
- `limit` (optional): Maximum results (default: 20)

**Example Requests:**
```bash
# Get all active alerts
GET /api/economy/alerts?active=true

# Get user-specific alerts
GET /api/economy/alerts?userId=12345
```

**Response:**
```json
[
  {
    "id": "alert-123",
    "userId": "user-456",
    "eventId": "be97ae6c-7f0b-4e9b-b8ab-eb5f29e86cf3",
    "alertType": "Event Reminder",
    "title": "Fed Rate Decision Alert",
    "message": "Federal Funds Rate decision in 30 minutes",
    "triggerTime": "2025-10-31T10:06:47.6381041Z",
    "isActive": true,
    "isTriggered": false,
    "createdAt": "2025-10-30T08:36:47.638Z"
  }
]
```

**Frontend Usage:**
- Economic event notification system
- Custom alert management
- Push notifications for important events
- User alert preferences

---

### 7. 🏷️ Economic Sectors
**Endpoint:** `GET /api/economy/sectors`

**Description:** Get economic sector classifications

**Parameters:**
- `limit` (optional): Maximum results (default: 50)

**Example Requests:**
```bash
# Get all economic sectors
GET /api/economy/sectors
```

**Response:**
```json
[
  {
    "id": "sector-1",
    "name": "Technology",
    "description": "Technology and software companies",
    "parentSector": null,
    "subsectors": ["Software", "Hardware", "Semiconductors"],
    "isActive": true
  }
]
```

**Frontend Usage:**
- Sector-based market analysis
- Industry classification systems
- Economic sector performance tracking

---

## 🔧 Implementation Guide

### Frontend Integration

#### 1. Authentication Setup
```javascript
// Store JWT token after login
const token = response.token;
localStorage.setItem('jwtToken', token);

// Include in all API requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

#### 2. API Calls with Error Handling
```javascript
async function fetchEconomicData(endpoint, params = {}) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const url = `http://localhost:5003/api/economy/${endpoint}${queryString ? '?' + queryString : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    // Handle authentication errors
    if (error.message.includes('401')) {
      // Redirect to login
      window.location.href = '/login';
    }
    throw error;
  }
}
```

#### 3. Real-time Updates (WebSocket)
```javascript
// Connect to SignalR for real-time economic updates
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/economy', {
    accessTokenFactory: () => localStorage.getItem('jwtToken')
  })
  .build();

// Listen for economic event updates
connection.on('EconomicEventUpdate', (eventData) => {
  console.log('New economic event:', eventData);
  // Update UI with new event
  updateEconomicCalendar(eventData);
});

connection.start();
```

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';

function EconomicCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEconomicCalendar();
  }, []);

  const fetchEconomicCalendar = async () => {
    try {
      setLoading(true);
      const data = await fetchEconomicData('calendar', {
        country: 'United States',
        importance: 'High'
      });
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading economic events...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="economic-calendar">
      <h2>Economic Calendar</h2>
      {events.map(event => (
        <div key={event.id} className={`event ${event.importance.toLowerCase()}`}>
          <h3>{event.title}</h3>
          <p>{event.country} - {event.currency}</p>
          <p>Time: {new Date(event.eventTime).toLocaleString()}</p>
          <p>Forecast: {event.forecast} | Previous: {event.previous}</p>
        </div>
      ))}
    </div>
  );
}

export default EconomicCalendar;
```

### Vue.js Component Example
```vue
<template>
  <div class="economic-dashboard">
    <h2>Economic Dashboard - {{ selectedCountry }}</h2>

    <div class="country-selector">
      <select v-model="selectedCountry" @change="loadDashboard">
        <option value="United States">United States</option>
        <option value="Eurozone">Eurozone</option>
        <option value="Japan">Japan</option>
      </select>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="dashboardData" class="dashboard-content">
      <div class="key-indicators">
        <h3>Key Indicators</h3>
        <div class="indicators-grid">
          <div v-for="(value, key) in dashboardData.keyIndicators" :key="key" class="indicator">
            <span class="label">{{ formatIndicatorName(key) }}:</span>
            <span class="value">{{ value }}</span>
          </div>
        </div>
      </div>

      <div class="upcoming-events">
        <h3>Upcoming Events</h3>
        <div v-for="event in dashboardData.upcomingEvents" :key="event.id" class="event">
          <h4>{{ event.title }}</h4>
          <p>{{ formatDate(event.eventTime) }}</p>
          <span :class="'importance-' + event.importance.toLowerCase()">{{ event.importance }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EconomicDashboard',
  data() {
    return {
      selectedCountry: 'United States',
      dashboardData: null,
      loading: false
    }
  },
  mounted() {
    this.loadDashboard();
  },
  methods: {
    async loadDashboard() {
      this.loading = true;
      try {
        const data = await this.$api.get(`economy/dashboard/${encodeURIComponent(this.selectedCountry)}`);
        this.dashboardData = data;
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        this.loading = false;
      }
    },
    formatIndicatorName(key) {
      return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleString();
    }
  }
}
</script>
```

## 🎯 Use Cases

### 1. **Trading Platforms**
- Real-time economic event alerts
- Fundamental analysis tools
- Currency strength indicators
- Economic calendar integration

### 2. **Financial Applications**
- Economic health monitoring
- Country risk assessment
- Investment decision support
- Market sentiment analysis

### 3. **Educational Platforms**
- Economic data visualization
- Learning economic concepts
- Historical economic data
- Real-time economic updates

### 4. **News Applications**
- Economic news aggregation
- Breaking news alerts
- Economic event coverage
- Market impact analysis

## ⚠️ Important Notes

1. **Authentication Required**: All endpoints require valid JWT tokens
2. **Rate Limiting**: Implement appropriate rate limiting on frontend
3. **Caching**: Cache economic data to reduce API calls
4. **Real-time Updates**: Use WebSocket connections for live updates
5. **Error Handling**: Implement comprehensive error handling
6. **Timezone Handling**: Convert UTC times to user timezone
7. **Data Freshness**: Check `lastUpdate` timestamps for data freshness

## 📞 Support

For technical support or questions about the Economy API:
- Check the Swagger documentation at `/swagger/index.html`
- Review the API logs for debugging
- Contact the development team for integration assistance

---

**Last Updated:** October 30, 2025
**API Version:** v1.0
**Base URL:** `http://localhost:5003/api/economy/`