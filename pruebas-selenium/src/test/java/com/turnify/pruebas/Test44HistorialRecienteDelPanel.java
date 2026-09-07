package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 44 - Historial reciente del panel: la tabla de turnos recientes muestra el estado de cada atencion (CP-35)")
class Test44HistorialRecienteDelPanel {

    private WebDriver empleado;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(empleado);
    }

    @Test
    void cp35_historialReciente() {
        empleado = Escenario.empleado();
        Acciones.ir(empleado, "/employee");
        Acciones.esperar(6000);
        Acciones.desplazarA(empleado, By.cssSelector(".all-turns-title"));
        Acciones.esperar(1500);

        String cuerpo = Acciones.textoPlano(empleado, By.cssSelector("body"));
        Evidencia.nota("historialRecienteTitulo", Acciones.texto(empleado, By.cssSelector(".all-turns-title")));
        Evidencia.captura(empleado, "em07_todos_los_turnos_recientes");

        assertTrue(cuerpo.contains("Todos los Turnos Recientes"),
                "El panel debe incluir la tabla de turnos recientes");
        assertTrue(cuerpo.contains("Atendido") || cuerpo.contains("Cancelado") || cuerpo.contains("Reagendado"),
                "El historial debe mostrar los estados de los turnos ya procesados");
    }
}
