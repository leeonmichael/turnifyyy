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

@DisplayName("Test 22 - Acceso al asistente TURNITY: se abre desde Inicio y responde las preguntas frecuentes (CP-24)")
class Test22ChatbotPreguntasFrecuentes {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp24_accesoYPreguntasFrecuentes() {
        cliente = Escenario.cliente();
        Acciones.ir(cliente, "/home");
        Acciones.esperarInicioCliente(cliente);

        Acciones.clic(cliente, By.cssSelector(".chatbot-bubble"));
        Acciones.visible(cliente,
                By.xpath("//*[contains(@class,'modal-title') and contains(.,'TURNITY')]"), Config.ESPERA);
        Evidencia.captura(cliente, "cp15a_modal_ir_chatbot");

        Acciones.clic(cliente, By.cssSelector(".chatbot-go-btn"));
        Acciones.esperaJs(cliente, "location.pathname.includes('/chatbot')", Config.ESPERA);
        Acciones.esperar(3500);

        String saludo = Acciones.textoPlano(cliente, By.cssSelector("body"));
        Evidencia.nota("chatbotSaludo", saludo.length() > 400 ? saludo.substring(0, 400) : saludo);
        Evidencia.captura(cliente, "cp15b_chatbot_bienvenida");

        List<WebElement> chips = Acciones.todos(cliente, By.cssSelector(".suggestion-chip"));
        List<String> textos = new ArrayList<>();
        chips.forEach(chip -> textos.add(chip.getText().trim()));
        Evidencia.nota("chatbotPreguntasFrecuentes", textos);

        assertTrue(saludo.contains("TURNITY"), "El chat debe presentarse como TURNITY");
        assertFalse(chips.isEmpty(), "Deben ofrecerse preguntas frecuentes como botones");

        int largo = Escenario.largoDeConversacion(cliente);
        Evidencia.nota("chatbotChipUsado", textos.get(0));
        Acciones.clic(cliente, chips.get(0));
        boolean respondio = Escenario.esperarRespuesta(cliente, largo);
        Evidencia.nota("chatbotRespondioChip", respondio);
        Evidencia.captura(cliente, "cp15c_chatbot_pregunta_frecuente");

        assertTrue(respondio, "El asistente debe responder a la pregunta frecuente seleccionada");
    }
}
