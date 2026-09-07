package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 51 - Diseno responsive: en pantalla de telefono la web se adapta y no aparece desplazamiento horizontal (CP-52)")
class Test51DisenoResponsive {

    private WebDriver movil;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(movil);
    }

    @Test
    void cp52_responsive() {
        movil = Navegador.movil();
        Acciones.ir(movil, "/login");
        Acciones.visible(movil, By.cssSelector("input[name=username]"), Config.ESPERA_LARGA);
        Acciones.esperar(2000);
        Evidencia.captura(movil, "cp24a_responsive_login_movil");

        Object desborde = ((JavascriptExecutor) movil)
                .executeScript("return document.documentElement.scrollWidth - window.innerWidth;");
        Evidencia.nota("desbordeHorizontalMovil", desborde);

        Acciones.iniciarSesion(movil, Cuentas.asegurarCliente(movil), Config.CLIENTE_CLAVE);
        Acciones.esperarInicioCliente(movil);
        Acciones.esperar(3000);
        Evidencia.captura(movil, "cp24b_responsive_home_movil");
        Evidencia.capturaCompleta(movil, "cp24c_responsive_home_movil_completo");

        String inicio = Acciones.textoPlano(movil, By.cssSelector("body"));
        Evidencia.nota("inicioMovilTexto", inicio.length() > 200 ? inicio.substring(0, 200) : inicio);

        assertTrue(((Number) desborde).intValue() <= 2,
                "La pantalla de telefono no debe tener desplazamiento horizontal, sobran "
                        + desborde + " px");
        assertTrue(inicio.toLowerCase().contains("turno"),
                "En el telefono debe verse la pantalla de Inicio del cliente");
    }
}
