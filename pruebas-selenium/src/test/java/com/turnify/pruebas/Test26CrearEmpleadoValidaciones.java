package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 26 - Validaciones al crear un empleado: exige los campos obligatorios y una contrasena minima (CP-42)")
class Test26CrearEmpleadoValidaciones {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp42_validacionesEmpleado() {
        administrador = Escenario.administrador();
        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
        Acciones.desplazarA(administrador, By.cssSelector(".employee-section"));
        Evidencia.captura(administrador, "ad02a_gestion_empleados_formulario");

        Acciones.clicTexto(administrador, "Crear Empleado");
        String camposVacios = Acciones.aceptarAlerta(administrador);
        Evidencia.nota("empleadoCamposVacios", camposVacios);

        Acciones.escribir(administrador, By.cssSelector("input[name=empUsername]"), "x");
        Acciones.escribir(administrador, By.cssSelector("input[name=empPassword]"), "12");
        Acciones.escribir(administrador, By.cssSelector("input[name=empFullName]"), "x");
        Acciones.clicTexto(administrador, "Crear Empleado");
        String claveCorta = Acciones.aceptarAlerta(administrador);
        Evidencia.nota("empleadoClaveCorta", claveCorta);

        assertTrue(camposVacios.toLowerCase().contains("complete"),
                "Sin datos debe avisar que faltan campos, mostro: " + camposVacios);
        assertTrue(claveCorta.toLowerCase().contains("contrase"),
                "Con una clave corta debe avisar el minimo de caracteres, mostro: " + claveCorta);
    }
}
