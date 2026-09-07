package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 12 - Solicitar turno presencial: el cliente elige tipo de atencion y sede y recibe su numero de turno (CP-12)")
class Test12SolicitarTurnoPresencial {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp12_turnoPresencial() {
        cliente = Escenario.cliente();
        Escenario.liberarTurnoDelCliente(cliente);
        Acciones.visible(cliente, By.cssSelector(".request-card"), Config.ESPERA_LARGA);

        Acciones.seleccionar(cliente, Acciones.todos(cliente, By.cssSelector(".request-card select")).get(0), "general");
        Acciones.seleccionar(cliente, Acciones.todos(cliente, By.cssSelector(".request-card select")).get(1), "presencial");
        Acciones.esperaJs(cliente,
                "document.querySelectorAll('.request-card select').length >= 3"
                        + " && document.querySelectorAll('.request-card select')[2].options.length > 0",
                Config.ESPERA_LARGA);

        List<Map<String, String>> sedes = new ArrayList<>();
        Select combo = new Select(Acciones.todos(cliente, By.cssSelector(".request-card select")).get(2));
        for (WebElement opcion : combo.getOptions()) {
            Map<String, String> sede = new LinkedHashMap<>();
            sede.put("v", opcion.getAttribute("value"));
            sede.put("t", opcion.getText().trim());
            sedes.add(sede);
        }
        Map<String, String> elegida = sedes.get(sedes.size() - 1);
        Evidencia.nota("sedes", sedes);
        Evidencia.nota("sedePruebas", elegida.get("t"));
        Evidencia.nota("sedePruebasId", elegida.get("v"));
        combo.selectByValue(elegida.get("v"));
        Acciones.esperar(600);
        Evidencia.captura(cliente, "cp10a_formulario_turno_presencial");

        Acciones.clic(cliente, By.cssSelector(".get-turn-btn"));
        Acciones.visible(cliente,
                By.xpath("//*[contains(@class,'modal-title') and contains(.,'Turno Asignado')]"), Config.ESPERA_LARGA);
        Evidencia.captura(cliente, "cp10b_modal_turno_asignado");
        Acciones.clicTexto(cliente, "Entendido");

        Acciones.visible(cliente, By.cssSelector(".turn-hero"), Config.ESPERA);
        Acciones.esperar(7000);
        String numero = Acciones.texto(cliente, By.cssSelector(".turn-hero-number"));
        String estado = Acciones.texto(cliente, By.cssSelector(".turn-status-chip"));
        String sedeEnTarjeta = Acciones.texto(cliente, By.cssSelector(".turn-hero-sede"));
        Evidencia.nota("turnoPresencial", numero);
        Evidencia.nota("turnoPresencialEstado", estado);
        Evidencia.nota("turnoPresencialSede", sedeEnTarjeta);
        Evidencia.captura(cliente, "cp10c_tarjeta_seguimiento_turno");
        Evidencia.capturaCompleta(cliente, "cp10d_tarjeta_seguimiento_completa");

        assertTrue(numero.startsWith("A"),
                "Un turno general debe llevar el prefijo A, se obtuvo: " + numero);
        assertEquals(elegida.get("t"), sedeEnTarjeta, "La tarjeta debe mostrar la sede elegida");
        assertTrue(estado.toLowerCase().contains("espera"), "El turno debe quedar en estado En espera");
    }
}
