package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 27 - Crear empleados: el administrador registra un empleado de sede y un especialista en turnos virtuales (CP-43)")
class Test27CrearEmpleados {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp43_crearEmpleados() {
        administrador = Escenario.administrador();
        String sede = Escenario.sede(administrador);
        String sufijo = Cuentas.sufijo();
        String presencial = "qa_emp_pres" + sufijo;
        String virtual = "qa_emp_virt" + sufijo;

        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);

        Cuentas.crearEmpleado(administrador, presencial, "Empleado QA Presencial", sede);
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + presencial + "\")]"));
        Evidencia.captura(administrador, "ad02c_empleado_creado_tabla");
        boolean creadoPresencial = Acciones.hayFila(administrador, presencial);

        Acciones.desplazarA(administrador, By.cssSelector(".employee-form"));
        Evidencia.captura(administrador, "ad02b_crear_empleado_datos");

        Cuentas.crearEmpleado(administrador, virtual, "Empleado QA Virtual", "VIRTUAL");
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + virtual + "\")]"));
        Evidencia.captura(administrador, "ad03b_empleado_virtual_creado");
        Evidencia.captura(administrador, "ad03a_crear_empleado_virtual_datos");
        boolean creadoVirtual = Acciones.hayFila(administrador, virtual);

        String filaVirtual = Acciones.fila(administrador, virtual).getText().replaceAll("\\s+", " ");
        Evidencia.nota("empleadoPresencial", presencial);
        Evidencia.nota("empleadoVirtual", virtual);
        Evidencia.nota("empleadoVirtualFila", filaVirtual);

        Acciones.desplazarA(administrador, By.cssSelector(".employee-form"));
        Cuentas.crearEmpleado(administrador, presencial, "Empleado QA Presencial", sede);
        String duplicado = Acciones.aceptarAlerta(administrador);
        Evidencia.nota("empleadoDuplicado", duplicado);

        assertTrue(creadoPresencial, "El empleado presencial debe aparecer en la tabla");
        assertTrue(creadoVirtual, "El especialista en turnos virtuales debe aparecer en la tabla");
        assertTrue(filaVirtual.contains("Virtual"), "El especialista debe quedar con la sede Virtual");
    }
}
