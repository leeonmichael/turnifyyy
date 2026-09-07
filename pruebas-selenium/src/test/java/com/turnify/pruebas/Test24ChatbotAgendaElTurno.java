package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 24 - TURNITY agenda el turno: el asistente guia con botones y crea el turno sin usar el formulario (CP-26)")
class Test24ChatbotAgendaElTurno {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp26_agendarDesdeElChat() {
        cliente = Escenario.cliente();
        Escenario.liberarTurnoDelCliente(cliente);
        Escenario.abrirChatbot(cliente);

        int largo = Escenario.largoDeConversacion(cliente);
        Escenario.escribirEnChat(cliente, "Quiero agendar un turno");
        boolean respondio = Escenario.esperarRespuesta(cliente, largo);
        Evidencia.nota("chatbotRespondioAgendar", respondio);
        Evidencia.captura(cliente, "cp17a_chatbot_agendar_turno");

        List<String> opciones = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            List<WebElement> botones = Acciones.todos(cliente, By.cssSelector(".quick-option-btn"));
            if (botones.isEmpty()) {
                break;
            }
            WebElement elegida = botones.get(botones.size() - 1);
            opciones.add(elegida.getText().trim());
            int antes = Escenario.largoDeConversacion(cliente);
            Acciones.clic(cliente, elegida);
            Escenario.esperarRespuesta(cliente, antes);
            Evidencia.captura(cliente, "cp17b_chatbot_opcion_" + i);
        }
        Evidencia.nota("chatbotOpcionesElegidas", opciones);
        Evidencia.capturaCompleta(cliente, "cp17c_chatbot_conversacion_completa");

        String conversacion = Acciones.textoPlano(cliente, By.cssSelector("body"));
        Evidencia.nota("chatbotConversacionFinal", conversacion.length() > 900
                ? conversacion.substring(conversacion.length() - 900) : conversacion);

        Acciones.ir(cliente, "/home");
        Acciones.esperar(8000);
        boolean hayTurno = Acciones.existe(cliente, By.cssSelector(".turn-hero-number"));
        String numero = hayTurno ? Acciones.texto(cliente, By.cssSelector(".turn-hero-number")) : "";
        Evidencia.nota("chatbotTurnoCreado", numero);
        Evidencia.captura(cliente, "cp17d_home_tras_chatbot");

        assertTrue(respondio, "El asistente debe guiar la solicitud del turno");
        assertFalse(opciones.isEmpty(),
                "El asistente debe ofrecer botones de respuesta rapida para elegir el tipo de turno");
        assertTrue(hayTurno,
                "Tras la conversacion, el turno agendado por TURNITY debe verse en la pantalla de Inicio");
    }
}
