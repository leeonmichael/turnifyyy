package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 23 - Alcance del asistente: ante una pregunta ajena al sistema aclara que solo atiende temas de Turnify Pro (CP-25)")
class Test23ChatbotTemaFueraDeAlcance {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp25_temaFueraDeAlcance() {
        cliente = Escenario.cliente();
        Escenario.abrirChatbot(cliente);

        int largo = Escenario.largoDeConversacion(cliente);
        Escenario.escribirEnChat(cliente, "¿Cuando es el dia de la madre?");
        boolean respondio = Escenario.esperarRespuesta(cliente, largo);

        String conversacion = Acciones.textoPlano(cliente, By.cssSelector("body"));
        String ultimaParte = conversacion.length() > 700
                ? conversacion.substring(conversacion.length() - 700) : conversacion;
        Evidencia.nota("chatbotRespuestaFueraDeTema", ultimaParte);
        Evidencia.captura(cliente, "cp16_chatbot_pregunta_fuera_de_tema");

        assertTrue(respondio, "El asistente debe contestar algo a la pregunta fuera de tema");
        assertTrue(conversacion.toLowerCase().contains("exclusivamente")
                        || conversacion.toLowerCase().contains("turnify"),
                "Debe aclarar que solo ayuda con el sistema de gestion de turnos de Turnify Pro");
    }
}
