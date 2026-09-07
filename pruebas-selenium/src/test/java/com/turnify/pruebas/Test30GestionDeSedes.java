package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 30 - Gestion de sedes: el administrador crea, edita y elimina una sede (CP-46)")
class Test30GestionDeSedes {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp46_sedes() {
        administrador = Escenario.administrador();
        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);

        String sede = "SEDE QA PRUEBA " + Cuentas.sufijo();
        Acciones.desplazarA(administrador, By.xpath("//h2[contains(.,'Gestión de Sedes')]"));
        Evidencia.captura(administrador, "ad06a_gestion_sedes");

        Acciones.clicTexto(administrador, "Crear Sede");
        String sinNombre = Acciones.aceptarAlerta(administrador);
        Evidencia.nota("sedeSinNombre", sinNombre);

        Acciones.escribir(administrador, By.cssSelector("input[name=newSedeName]"), sede);
        Acciones.escribir(administrador, By.cssSelector("input[name=newSedeCity]"), "BOGOTA");
        Acciones.escribir(administrador, By.cssSelector("input[name=newSedeAddress]"), "CALLE 1 # 2-3");
        Evidencia.captura(administrador, "ad06b_crear_sede_datos");
        Acciones.clicTexto(administrador, "Crear Sede");
        boolean creada = Acciones.esperaJs(administrador,
                "document.body.innerText.includes('" + sede + "')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + sede + "\")]"));
        Evidencia.captura(administrador, "ad06c_sede_creada");

        Acciones.clic(administrador, By.xpath("//tr[contains(., \"" + sede + "\")]//button[normalize-space()='Editar']"));
        Acciones.esperar(1200);
        List<WebElement> ciudades = Acciones.todos(administrador, By.cssSelector("input[placeholder='Ciudad']"));
        WebElement ciudad = ciudades.get(ciudades.size() - 1);
        ciudad.clear();
        ciudad.sendKeys("SOACHA");
        Evidencia.captura(administrador, "ad06d_editar_sede");

        List<WebElement> guardar = Acciones.todos(administrador, By.xpath("//button[normalize-space()='Guardar']"));
        Acciones.clic(administrador, guardar.get(guardar.size() - 1));
        boolean editada = Acciones.esperaJs(administrador,
                "[...document.querySelectorAll('tr')].some(f => f.innerText.includes('" + sede
                        + "') && f.innerText.includes('SOACHA'))", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Acciones.desplazarA(administrador, By.xpath("//tr[contains(., \"" + sede + "\")]"));
        Evidencia.captura(administrador, "ad06e_sede_editada");

        Acciones.clic(administrador, By.xpath("//tr[contains(., \"" + sede + "\")]//button[normalize-space()='Eliminar']"));
        String confirmacion = Acciones.aceptarAlerta(administrador);
        boolean eliminada = Acciones.esperaJs(administrador,
                "!document.body.innerText.includes('" + sede + "')", Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Acciones.desplazarA(administrador, By.xpath("//h2[contains(.,'Gestión de Sedes')]"));
        Evidencia.captura(administrador, "ad06f_sede_eliminada");
        Evidencia.nota("sedeConfirmacionEliminar", confirmacion);

        assertTrue(sinNombre.toLowerCase().contains("nombre"),
                "Sin nombre debe pedir el nombre de la sede, mostro: " + sinNombre);
        assertTrue(creada, "La sede creada debe aparecer en la tabla");
        assertTrue(editada, "El cambio de ciudad debe reflejarse en la tabla");
        assertTrue(eliminada, "La sede eliminada debe desaparecer de la tabla");
    }
}
