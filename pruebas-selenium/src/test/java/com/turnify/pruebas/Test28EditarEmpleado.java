package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 28 - Editar un empleado: el cambio de nombre se guarda y se refleja en la tabla (CP-44)")
class Test28EditarEmpleado {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp44_editarEmpleado() {
        Escenario.prepararEmpleados();
        String empleado = Cuentas.empleadoPresencial();
        administrador = Escenario.administrador();
        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);

        Acciones.clic(administrador,
                By.xpath("//tr[contains(., \"" + empleado + "\")]//button[normalize-space()='Editar']"));
        Acciones.visible(administrador, By.cssSelector(".edit-form"), Config.ESPERA);
        Acciones.desplazarA(administrador, By.cssSelector(".edit-form"));
        Acciones.escribir(administrador, By.cssSelector(".edit-form input[placeholder='Nombre Completo']"),
                "Empleado QA Presencial Editado");
        Evidencia.captura(administrador, "ad04a_editar_empleado_formulario");

        Acciones.clic(administrador,
                By.xpath("//div[contains(@class,'edit-form')]//button[normalize-space()='Guardar']"));
        boolean guardado = Acciones.esperaJs(administrador,
                "document.body.innerText.includes('Presencial Editado')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + empleado + "\")]"));
        Evidencia.captura(administrador, "ad04b_empleado_editado");
        Evidencia.nota("empleadoEditado", guardado);

        assertTrue(guardado, "El nuevo nombre del empleado debe verse en la tabla");
    }
}
