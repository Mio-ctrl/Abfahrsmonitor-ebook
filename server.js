const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/vvo', async (req, res) => {
  try {
    const response = await fetch('https://webapi.vvo-online.de/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// Neue Route für Home Assistant
app.get('/api/departures/:stopId', async (req, res) => {
    try {
        const stopId = req.params.stopId; // z.B. "33000037" für Hauptbahnhof Dresden
        
        // VVO API URL (gleiche wie in deinem Frontend)
        const vvoUrl = `https://webapi.vvo-online.de/dm?format=xml&stopid=${stopId}&limit=10&shorttermchanges=true&mentzquality=1`;
        
        // API Aufruf über deinen eigenen Proxy (um CORS zu umgehen)
        const proxyUrl = `https://vvo-cors-proxy.onrender.com/${vvoUrl}`;
        
        const response = await fetch(proxyUrl);
        const xmlText = await response.text();
        
        // XML Parser (nutze den gleichen Code wie in deinem Frontend)
        const { DOMParser } = require('xmldom');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const departures = [];
        const departureElements = xmlDoc.getElementsByTagName('Departure');
        
        for (let i = 0; i < departureElements.length; i++) {
            const departure = departureElements[i];
            
            // Extrahiere Daten (angepasst an VVO XML-Struktur)
            const line = departure.getAttribute('LineName') || 'N/A';
            const destination = departure.getAttribute('Direction') || 'N/A';
            const platform = departure.getAttribute('Platform') || '';
            
            // Realtime Daten
            const rtTime = departure.getAttribute('RealTime') || departure.getAttribute('ScheduledTime');
            const currentTime = new Date();
            const depTime = new Date(rtTime);
            const minutes = Math.max(0, Math.round((depTime - currentTime) / 60000));
            
            departures.push({
                line: line,
                destination: destination,
                minutes: minutes,
                time: depTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                platform: platform,
                delay: departure.getAttribute('Delay') || 0
            });
        }
                // Response für Home Assistant formatieren
        const responseData = {
            departures: departures.slice(0, 8), // Erste 8 Abfahrten
            count: departures.length,
            lastUpdate: new Date().toISOString(),
            stopId: stopId,
            stopName: xmlDoc.getElementsByTagName('StopName')[0]?.textContent || 'Dresden Haltestelle'
        };
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Fehler beim Abrufen der VVO Daten:', error);
        res.status(500).json({
            error: error.message,
            departures: [],
            count: 0,
            lastUpdate: new Date().toISOString()
        });
    }
});

// Test Route
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funktioniert!', 
        time: new Date().toISOString(),
        endpoints: [
            '/api/departures/33000037 (Hauptbahnhof Dresden)',
            '/api/departures/33000742 (Beispiel andere Haltestelle)'
        ]
    });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy läuft auf Port ${PORT}`));
