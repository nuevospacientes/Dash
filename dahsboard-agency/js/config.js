/* ==========================================
   CONFIGURACIÓN GLOBAL Y BASE DE DATOS
   ========================================== */

const DB_URLS = {
    // 0. Seguridad
    accesos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=568198634&single=true&output=csv",
    
    // 1. Embudos y Leads
    leadsGenerados: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1334038379&single=true&output=csv",
    leadsContactados: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=0&single=true&output=csv",
    leadsAntiguos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=482573997&single=true&output=csv",
    
    // 2. Calidad de Llamadas
    llamadasConectadas: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1951435987&single=true&output=csv",
    
    // 3. Citas y Asistencias
    citasGeneradas: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=2080204459&single=true&output=csv",
    shows: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1058387781&single=true&output=csv",
    showsNt: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1260765281&single=true&output=csv",
    noShows: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1792330943&single=true&output=csv",
    cancelaCita: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1896787364&single=true&output=csv",
    
    // 4. Inversión (Meta Ads - Lo agregaremos después)
    metaAds: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSb25KgppbiMB-eyU2UaRRLMQmjzMVOOuqh0M2ov06kkhYyIrPMKjvjwPnZsHqlPeyXwc2px7ZzXuyC/pub?gid=1638252590&single=true&output=csv" 
};

// Objeto global donde vivirá toda nuestra data una vez descargada
window.AppData = {
    raw: {},
    filtered: {}
};
