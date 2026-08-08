importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD8oE-qMClxDvKWha8gbr3c491bPLJ8SAE",
  authDomain: "ruhulqudus-48d29.firebaseapp.com",
  projectId: "ruhulqudus-48d29",
  messagingSenderId: "177306595727",
  appId: "1:177306595727:web:3ab58c1d6714831c9e1bfa",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon.png",
  });
});