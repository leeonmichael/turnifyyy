package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 35 - Llamar el siguiente turno: el boton LLAMAR SIGUIENTE pasa a atencion el turno mas antiguo de la cola (CP-28)")
class Test35LlamarSiguienteTurno {

    private WebDriver empleado;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp28_llamarSiguiente() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);

        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + turno + "')", Config.ESPERA_LARGA);

        Acciones.ir(empleado, "/employee");
        Acciones.esperar(4000);
        String primeroDeLaCola = Acciones.texto(empleado, By.cssSelector(".turn-item .turn-number"));
        String enAtencion = Escenario.llamarSiguiente(empleado);
        Evidencia.nota("primeroDeLaCola", primeroDeLaCola);
        Evidencia.nota("turnoLlamado", enAtencion);
        Evidencia.captura(empleado, "em02a_llamar_siguiente_turno_actual");

        assertEquals(primeroDeLaCola, enAtencion,
                "Debe llamarse el primer turno de la cola (" + primeroDeLaCola + "), incluido " + turno);
        assertTrue(Acciones.existe(empleado, By.cssSelector("#currentTurn")),
                "El panel debe mostrar el turno en atencion");
    }
}
