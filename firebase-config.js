// Firebase-Projekt-Konfiguration für die Live-Synchronisation zwischen zwei Geräten.
// Werte stammen aus der Firebase-Konsole (console.firebase.google.com):
// Projekteinstellungen > Meine Apps > Web-App > SDK-Setup und Konfiguration.
// Dieser Wert ist kein Geheimnis - die Absicherung erfolgt über die Realtime-Database-Rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBueyq6gdQMTrUv7YQvO-9M9dVnxtF5wtI',
  databaseURL: 'https://educodenames-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'educodenames',
};

firebase.initializeApp(firebaseConfig);
