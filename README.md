# 🚀 Turnify Pro – Sistema Inteligente de Gestión de Turnos

## 👥 Integrantes del proyecto
- **Maycol Esneider Posada Leon**
- **Juan Manuel Baracaldo**
- **Nicolas Ruiz**

📚 **Instructor:** Crhistian  
🆔 **Ficha:** 3203084  

---

# 📖 Descripción del proyecto

**Turnify Pro** es un sistema digital de gestión de turnos diseñado para organizar la atención de usuarios en lugares donde normalmente se generan filas largas.

El sistema permite visualizar los turnos en tiempo real y notificar a los usuarios cuando su turno está próximo a ser atendido.

Este sistema puede utilizarse en:

- 🏦 Bancos  
- 🏥 Hospitales  
- 🏢 Oficinas de atención al cliente  
- 🏛️ Entidades públicas  
- 🍽️ Restaurantes  

El objetivo principal es **reducir filas físicas y mejorar la experiencia del usuario mediante tecnología digital**.

---

# 🎯 Objetivo del sistema

Desarrollar una plataforma que permita:

- Generar turnos automáticamente
- Visualizar el turno actual en una pantalla
- Notificar al usuario cuando su turno está próximo
- Organizar la atención de manera eficiente
- Reducir tiempos de espera

---

# 🛠️ Tecnologías utilizadas

## Lenguajes de programación

- **HTML5**
- **CSS3**
- **JavaScript**

## Herramientas utilizadas

- **Firebase**
- **Templates Backend**
- **Digital Signage Interface**

---

# 📦 Librerías y dependencias

El proyecto utiliza principalmente tecnologías web estándar:

- HTML
- CSS
- JavaScript

Para la sincronización de datos en tiempo real se utiliza:

- **Firebase Firestore / Firebase Realtime Database**

Firebase permite que los turnos se actualicen automáticamente en todas las pantallas conectadas.

---

# ⚙️ Funcionamiento del sistema

El sistema sigue el siguiente flujo:

1. El usuario solicita un turno.
2. El sistema genera un número de turno.
3. El turno se almacena en la base de datos.
4. La pantalla principal muestra el turno que está siendo atendido.
5. Los usuarios pueden monitorear el avance de la fila.
6. Cuando faltan pocos turnos, el sistema envía una alerta.

---

# 🖥️ Pantalla de turnos

La pantalla principal del sistema muestra el turno actual utilizando JavaScript.

### Código principal

```javascript
const turns = ['A001', 'A002', 'A003', 'A004', 'A005'];
let currentIndex = 0;

setInterval(() => {

    let currentTurn = turns[currentIndex];

    document.getElementById('turn').textContent = currentTurn;

    currentIndex = (currentIndex + 1) % turns.length;

}, 4000);
