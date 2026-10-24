const firebaseConfig = {
  apiKey: "AIzaSyBrPMp5-DgaXn8WGVXdSZi1WCQIUndJkvM",
  authDomain: "come-on-play-b4fa1.firebaseapp.com",
  projectId: "come-on-play-b4fa1",
  storageBucket: "come-on-play-b4fa1.firebasestorage.app",
  messagingSenderId: "273304076815",
  appId: "1:273304076815:web:f8db56aa14a4169d51197a"
};

(function initComeOnPlayFirebase() {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK не загружен: инициализация пропущена");
    return;
  }

  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  window.ComeOnPlayFirebase = {
    app: app,
    auth: auth,
    db: db
  };

  console.log("Firebase инициализирован");
  console.log("Firestore доступен");
  console.log("Auth доступен");
})();
