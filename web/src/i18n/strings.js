// Site-wide UI strings, one tree per language. Component code never embeds
// English literals directly (aside from a few things that are deliberately
// never translated — see the note on original-document text in
// DemoPreview.jsx and HowItWorks.jsx) — it looks everything up through
// useLanguage().t() so the whole site follows a single language choice,
// the same one used for document annotations.
export const translations = {
  en: {
    common: {
      disclaimer:
        "This tool does not provide medical advice. It only helps explain the objective content of a document — always consult a qualified healthcare provider for interpretation and care decisions.",
      signOut: "Sign out",
      backToDocuments: "← Back to documents",
      back: "← Back",
      loading: "Loading…",
      openInNewTab: "Open in new tab",
      noSourceFound: "No clear supporting source found.",
      tryAgain: "Try again",
      gotIt: "Got it",
      explain: "Explain",
      explaining: "Explaining…",
    },
    signIn: {
      checkEmailTitle: "Check your email",
      checkEmailBody:
        "We sent a sign-in link to **{email}**. Open it on this device to finish signing in.",
      sessionExpired:
        "You were signed out — this can happen if you signed out from another tab or device (accounts share one sign-in across all of them). Please sign in again.",
      heroEyebrow: "Scan reports & doctor's notes",
      heroTitle: "Written for a doctor. Explained for you.",
      heroSub:
        "Upload a report and read it beside a plain-language explanation of every term it assumes you already know — in **English, Spanish, or Traditional Chinese**, with a link to the published research behind each one.",
      inviteOnlyNotice: "This app is invite-only. Enter your invited email to get a sign-in link.",
      emailPlaceholder: "you@example.com",
      sendLink: "Send me a sign-in link",
      sending: "Sending…",
      footer: "Created by Jonathan Yuen ({email}) — questions welcome.",
    },
    dashboard: {
      signedInAs: "Signed in as {email}",
      welcomeBack: "Welcome back, ",
      welcome: "Welcome, ",
      greetingEmpty: "Add your first report below to see how it works.",
      nothingNew: "Nothing new since you were last here.",
      reportsReady: ({ n }) => `${n} report${n === 1 ? " is" : "s are"} ready to read.`,
      moreProcessing: ({ n }) =>
        `${n === 1 ? "Another" : `${n} more`} still being explained — you don't need to wait around for ${n === 1 ? "it" : "them"}.`,
      couldntProcessed: ({ n }) =>
        `${n} couldn't be processed — you can remove ${n === 1 ? "it" : "them"} and try again.`,
      addReportTitle: "Add a report",
      addReportLead: "A lab result, scan report, or doctor's note — as a PDF.",
      uploading: "Uploading…",
      dropHint: "Drop a PDF here, or",
      chooseFile: "Choose a file",
      commonQuestions: "Common questions",
      q1: "Where do I get the PDF?",
      a1: "In MyChart or LiveWell, open the result and choose `Download`, or the printer icon, and save it as a PDF. On a phone, tap Share, then Save to Files.",
      q2: "Who can see what I add?",
      a2: "Only you. Your name, birthday, and record number are removed before anything is sent to be explained.",
      q3: "How long does it take?",
      a3: "About a minute. You can close the page and come back later.",
      q4: "Will it tell me if something is wrong?",
      a4: "No. It explains what the words mean. What your results mean for you is a conversation with your doctor.",
      howLink: "How this works, and how your document is kept private →",
      yourReports: "Your reports",
      reportsCount: ({ n }) => `${n} report${n === 1 ? "" : "s"} · newest first`,
      loadingDocuments: "Loading documents…",
      emptyState: "No reports yet — add your first one to see how it works.",
      readExplanation: "Read the explanation",
      moreActionsFor: "More actions for {name}",
      rename: "Rename",
      delete: "Delete",
      deleteConfirm: "Delete this document? This can't be undone.",
      renamePrompt: "Rename document:",
      addedOn: "Added {date}",
      statusReady: "Explanation ready",
      statusProcessing: "Still processing",
      statusFailed: "Couldn't be processed",
    },
    documentViewer: {
      generatingAnnotations: "Generating annotations… this can take a little while the first time.",
      theseAreTerms:
        "These are the terms we judged most important to explain. Don't see one you're confused about? Select any other text in the document, or type one below, to ask about it too.",
      originalDocument: "Original document",
      loadingDocument: "Loading document…",
      originalNote:
        "This is your original file, exactly as you uploaded it. Only a copy with your personal details blacked out was ever shown to the AI.",
      whySummary: "Why can I still see my name and details here?",
      whyBody:
        "PlainMed never edits or hides anything in the document you see — it's private to your account, so there's no reason to hide it from you. Before the AI ever reads your report, a separate, temporary copy is made with your name, birthdate, and other identifying details blacked out, and only that stripped copy is sent to the AI. The file on this screen was never touched.",
      whyLink: "See the full explanation of how this works →",
    },
    demoPreview: {
      ariaLabel: "Sample of how a document is explained",
      sampleReportLabel: "Sample report — synthetic data, not a real patient",
      originalDocumentAlways: "Original document — always in its own language",
      hint:
        "Hover or tap a highlighted phrase, or switch languages anytime — this is the actual annotation view you'll get for your own documents, not a mockup.",
    },
    askAboutTerm: {
      prompt: "Still have a question about a specific word or phrase?",
      inputPlaceholder: "Type or paste a term from the document",
    },
    explainPopover: {
      explainQuoted: 'Explain "{text}"',
    },
    howItWorks: {
      pageTitle: "How this works, and why your document is safe",
      pipeline: {
        heading: "What happens to your document",
        steps: [
          "You upload a scan report or doctor's note as a PDF.",
          "The text is pulled out of the PDF on our server, and identifying details — name, birthdate, ID numbers, address — are automatically found and removed. This happens immediately, before anything else.",
          "Only that stripped-down, de-identified text is shown to the AI. It never sees the original file, your name, or any other identifying detail.",
          "The AI picks out the key findings and looks them up against real published medical research — it's never allowed to cite a source that isn't from that real, retrieved list.",
          "You see a plain-language explanation of each finding, side by side with your original document, in your preferred language.",
        ],
        calloutTitle: "An important distinction",
        calloutBody:
          "The document viewer (step 5) always shows **your original file, exactly as you uploaded it** — it's your document, private to your account, so there's no reason to hide it from you. The redacted version is a separate copy that only ever exists for the AI to read. Nothing about what you see changes; what changes is what the AI is ever allowed to see.",
      },
      doesDoesnt: {
        heading: "What this tool does — and doesn't do",
        intro:
          "Reading a document is not the same as interpreting it. A general-purpose AI chatbot would also explain a report like this — and would also, confidently, invent a citation that doesn't exist, and see your document exactly as written, identifying details included. This tool is built to only ever do the first part, and to strip identifying details before the AI sees anything at all:",
        doesTitle: "What it does",
        doesItems: [
          "Puts a plain-language explanation beside every term the report assumes you know.",
          "Shows you which phrase an explanation belongs to — hover or tap one and the other lights up.",
          "Writes in English, Spanish, or Traditional Chinese from the same source document.",
          "Links each explanation to real, retrieved research you can open and read yourself.",
        ],
        doesntTitle: "What it doesn't",
        doesntItems: [
          "Doesn't tell you what your results mean for you.",
          "Doesn't diagnose, stage, score, or predict anything.",
          "Doesn't recommend treatment, or tell you whether to worry.",
          "Doesn't cite what it can't show you — if no paper was found, it says so.",
        ],
      },
      demo: {
        heading: "See it for yourself",
        intro:
          "Here's a fabricated example — not a real patient — showing exactly what the redaction step does before anything reaches the AI. Your own document viewer would still show the left-hand version; only the AI ever sees the right-hand one.",
        beforeLabel: "What you upload — and what you always see",
        afterLabel: "What the AI actually sees",
        caption:
          "Notice what's left behind: the actual medical finding (\"2.1 cm nodule... concerning for malignancy\") stays fully readable — only the details that identify _who_ the document belongs to are removed.",
      },
      access: {
        heading: "Access & privacy — small on purpose",
        intro: "This tool was built for a family reading their own reports, and it's sized like it.",
        inviteOnlyTitle: "Invite only",
        inviteOnlyBody: "There is no sign-up page. An address has to be on the invite list before it can sign in at all.",
        noPasswordsTitle: "No passwords",
        noPasswordsBody:
          "Enter your email and a one-time sign-in link arrives, good for fifteen minutes. Nothing to remember, nothing to leak.",
        yoursTitle: "Your documents stay yours",
        yoursBody: "Uploads are private to the account that made them, and visible to no other user.",
      },
      hipaa: {
        heading: 'What "HIPAA compliant" actually means',
        intro:
          "HIPAA is the U.S. law governing how health information has to be protected. Being compliant with it isn't one setting to switch on — it's a bundle of separate safeguards that all have to be true at once:",
        items: [
          {
            strong: 'A signed agreement (a "BAA") with every vendor that touches health data',
            rest: "— it makes them legally responsible for protecting it too, not just you.",
          },
          {
            strong: "Encryption",
            rest: "— scrambling data both while it's stored and while it's moving between systems, so it's unreadable if it's ever intercepted.",
          },
          {
            strong: "Access controls",
            rest: "— only specific, authorized systems and people can read the data, and only what they genuinely need to.",
          },
          {
            strong: "Audit logging",
            rest: "— a record of exactly who or what accessed a piece of data, and when.",
          },
          {
            strong: "Breach notification",
            rest: "— a legal duty to tell affected people if their data is ever exposed.",
          },
        ],
      },
      roadmap: {
        heading: "Where this is headed",
        intro:
          "We're actively building out the full infrastructure above as part of a migration to Google Cloud. Some of it protects your documents today; the rest is real, in-progress work — not finished yet, and we'd rather say so plainly than imply otherwise.",
        activeNow: "Active now",
        inProgress: "In progress",
        items: [
          {
            status: "live",
            title: "Redaction before the AI ever sees your document",
            detail: "Our own system finds and removes identifying details on every upload, automatically.",
          },
          {
            status: "live",
            title: "Google Cloud DLP as a second, independent detection layer",
            detail: "Google's own industry-standard scanner for identifiers, running alongside our system rather than instead of it.",
          },
          {
            status: "live",
            title: "Encrypted storage with keys we control",
            detail: "Documents encrypted at rest using our own managed encryption keys, not just a provider default.",
          },
          {
            status: "live",
            title: "A database with no public entry point",
            detail: "The database that stores your account and results is unreachable from the open internet, full stop.",
          },
          {
            status: "live",
            title: "An enterprise AI backend instead of a consumer one",
            detail:
              "Runs on Google's enterprise AI offering instead of the consumer API, which doesn't train its models on your data and is eligible for a formal healthcare-data agreement.",
          },
          {
            status: "live",
            title: "A full audit trail",
            detail: "A logged record of exactly when and how each document was accessed.",
          },
          {
            status: "progress",
            title: "A web application firewall",
            detail: "Automated blocking of common attack patterns before they ever reach the app.",
          },
          {
            status: "progress",
            title: "A signed Business Associate Agreement (BAA)",
            detail: "A formal legal agreement with our cloud provider — the last piece, and the one that makes all the rest count.",
          },
        ],
      },
      goodToKnow: {
        heading: "Good to know",
        body:
          'This app is invite-only, built for a small circle of family and friends — it isn\'t run as a certified hospital system yet, for exactly the reasons in the checklist above. The protections marked "Active now" are real and run on every upload today. If you\'re ever unsure, it\'s completely fine to black out or remove any detail yourself before uploading.',
      },
      detailsSummary: "Learn more: how the two layers of de-identification work",
      details: {
        layer1Title: "Layer 1 — Google Cloud DLP",
        layer1Body:
          "Google's Data Loss Prevention service scans for standard identifiers — full names, phone numbers, email addresses, social security numbers, street addresses, dates — using detectors Google builds and maintains across a huge range of document types. It's a generalist: broad coverage of identifiers that show up in almost any kind of document, medical or not.",
        layer2Title: "Layer 2 — Our own redaction system",
        layer2Intro: "Three techniques, layered together:",
        layer2Items: [
          {
            strong: "Labeled fields",
            rest: '— anything following a header like "Patient Name:", "DOB:", "MRN:", or "Address:" is removed automatically.',
          },
          {
            strong: "Narrative mentions",
            rest: '— phrasing like "Patient Jane Doe presents with..." is recognized and redacted even outside a labeled field.',
          },
          {
            strong: "Medical-text recognition",
            rest: "— a model trained to recognize names, places, and dates within ordinary sentences catches what the first two techniques miss.",
          },
        ],
        whyTwoLayers:
          "**Why two layers?** No single method catches everything. A generalist identifier scanner (Layer 1) can miss a name embedded in unusual medical phrasing that Layer 2's medical-specific patterns are built to catch — and Layer 2, built for clinical documents specifically, doesn't know to look for things like credit card numbers the way a generalist scanner does. Running both means one layer's blind spot is usually the other's strength.",
      },
    },
    tour: {
      ctaButton: "Take the 2-minute tour",
      replayLink: "Replay tour",
      sampleDocumentTitle: "Sample report (guided tour)",
      stepCounter: ({ step, total }) => `Step ${step} of ${total}`,
      back: "Back",
      next: "Next",
      skip: "Skip tour",
      done: "Done",
      steps: [
        {
          title: "Let's take a real look around",
          body: "This is a real, synthetic sample report — not a mockup. Everything you're about to try (highlighting, explanations, language switching) is the actual product, running for real.",
        },
        {
          title: "Hover to see it explained",
          body: "Hover or tap a highlighted phrase in the document, or one of the explanations on the left — the other one lights up. That's how a term and its plain-language explanation stay connected.",
        },
        {
          title: "Explanations, side by side",
          body: "Every finding gets a plain-language explanation, backed by real, retrieved research you can open and read yourself.",
        },
        {
          title: "Select any phrase to ask about it",
          body: 'Try it now: select the phrase "adrenal glands" in the document, then click "Explain" — this asks the real AI, on the spot, just like it would for your own report.',
        },
        {
          title: "Read in your language",
          body: "This switch controls the whole site, including this very report — try English, Spanish, or Traditional Chinese.",
        },
        {
          title: "Or just type it",
          body: "Don't see the word you're curious about? Type or paste it here instead of selecting it in the document.",
        },
        {
          title: "Ready for your own report?",
          body: "Click \"← Back to documents\" whenever you're ready, then add a real report of your own from the dashboard.",
        },
      ],
    },
  },

  es: {
    common: {
      disclaimer:
        "Esta herramienta no ofrece asesoramiento médico. Solo ayuda a explicar el contenido objetivo de un documento — consulta siempre a un profesional de la salud cualificado para la interpretación y las decisiones de atención.",
      signOut: "Cerrar sesión",
      backToDocuments: "← Volver a los documentos",
      back: "← Volver",
      loading: "Cargando…",
      openInNewTab: "Abrir en una pestaña nueva",
      noSourceFound: "No se encontró una fuente de respaldo clara.",
      tryAgain: "Intentar de nuevo",
      gotIt: "Entendido",
      explain: "Explicar",
      explaining: "Explicando…",
    },
    signIn: {
      checkEmailTitle: "Revisa tu correo",
      checkEmailBody:
        "Enviamos un enlace de acceso a **{email}**. Ábrelo en este dispositivo para terminar de iniciar sesión.",
      sessionExpired:
        "Se cerró tu sesión — esto puede pasar si cerraste sesión desde otra pestaña o dispositivo (las cuentas comparten un único inicio de sesión). Vuelve a iniciar sesión.",
      heroEyebrow: "Informes médicos y notas del médico",
      heroTitle: "Escrito para un médico. Explicado para ti.",
      heroSub:
        "Sube un informe y léelo junto a una explicación en lenguaje sencillo de cada término que se supone que ya conoces — en **inglés, español o chino tradicional**, con un enlace a la investigación publicada detrás de cada uno.",
      inviteOnlyNotice: "Esta aplicación es solo por invitación. Ingresa tu correo invitado para recibir un enlace de acceso.",
      emailPlaceholder: "tucorreo@ejemplo.com",
      sendLink: "Enviarme un enlace de acceso",
      sending: "Enviando…",
      footer: "Creado por Jonathan Yuen ({email}) — con gusto respondemos tus preguntas.",
    },
    dashboard: {
      signedInAs: "Sesión iniciada como {email}",
      welcomeBack: "Bienvenido de nuevo, ",
      welcome: "Bienvenido, ",
      greetingEmpty: "Agrega tu primer informe abajo para ver cómo funciona.",
      nothingNew: "Nada nuevo desde tu última visita.",
      reportsReady: ({ n }) =>
        n === 1 ? "1 informe está listo para leer." : `${n} informes están listos para leer.`,
      moreProcessing: ({ n }) =>
        n === 1
          ? "Otro más se sigue explicando — no tienes que esperar por él."
          : `${n} más se siguen explicando — no tienes que esperar por ellos.`,
      couldntProcessed: ({ n }) =>
        n === 1
          ? "1 no se pudo procesar — puedes eliminarlo e intentarlo de nuevo."
          : `${n} no se pudieron procesar — puedes eliminarlos e intentarlo de nuevo.`,
      addReportTitle: "Agregar un informe",
      addReportLead: "Un resultado de laboratorio, informe de estudio o nota del médico — en PDF.",
      uploading: "Subiendo…",
      dropHint: "Suelta un PDF aquí, o",
      chooseFile: "Elegir un archivo",
      commonQuestions: "Preguntas frecuentes",
      q1: "¿Dónde consigo el PDF?",
      a1: "En MyChart o LiveWell, abre el resultado y elige `Descargar`, o el ícono de impresora, y guárdalo como PDF. En el teléfono, toca Compartir y luego Guardar en Archivos.",
      q2: "¿Quién puede ver lo que agrego?",
      a2: "Solo tú. Tu nombre, fecha de nacimiento y número de expediente se eliminan antes de enviar cualquier cosa a explicar.",
      q3: "¿Cuánto tiempo tarda?",
      a3: "Cerca de un minuto. Puedes cerrar la página y volver más tarde.",
      q4: "¿Me dirá si algo está mal?",
      a4: "No. Explica lo que significan las palabras. Lo que tus resultados significan para ti es una conversación con tu médico.",
      howLink: "Cómo funciona esto, y cómo se protege tu documento →",
      yourReports: "Tus informes",
      reportsCount: ({ n }) =>
        n === 1 ? "1 informe · el más reciente primero" : `${n} informes · el más reciente primero`,
      loadingDocuments: "Cargando documentos…",
      emptyState: "Aún no hay informes — agrega el primero para ver cómo funciona.",
      readExplanation: "Leer la explicación",
      moreActionsFor: "Más acciones para {name}",
      rename: "Renombrar",
      delete: "Eliminar",
      deleteConfirm: "¿Eliminar este documento? Esta acción no se puede deshacer.",
      renamePrompt: "Renombrar documento:",
      addedOn: "Agregado el {date}",
      statusReady: "Explicación lista",
      statusProcessing: "Aún procesando",
      statusFailed: "No se pudo procesar",
    },
    documentViewer: {
      generatingAnnotations: "Generando anotaciones… la primera vez puede tardar un poco.",
      theseAreTerms:
        "Estos son los términos que consideramos más importantes de explicar. ¿No ves uno que te genera dudas? Selecciona cualquier otro texto del documento, o escribe uno abajo, para preguntar también por él.",
      originalDocument: "Documento original",
      loadingDocument: "Cargando documento…",
      originalNote:
        "Este es tu archivo original, exactamente como lo subiste. Solo se le mostró a la IA una copia con tus datos personales tachados.",
      whySummary: "¿Por qué todavía puedo ver mi nombre y mis datos aquí?",
      whyBody:
        "PlainMed nunca edita ni oculta nada en el documento que ves — es privado para tu cuenta, así que no hay razón para ocultártelo. Antes de que la IA lea tu informe, se crea una copia aparte y temporal con tu nombre, fecha de nacimiento y otros datos identificativos tachados, y solo esa copia reducida se envía a la IA. El archivo que ves en esta pantalla nunca se modificó.",
      whyLink: "Ver la explicación completa de cómo funciona esto →",
    },
    demoPreview: {
      ariaLabel: "Ejemplo de cómo se explica un documento",
      sampleReportLabel: "Informe de muestra — datos sintéticos, no es un paciente real",
      originalDocumentAlways: "Documento original — siempre en su propio idioma",
      hint:
        "Pasa el cursor o toca una frase resaltada, o cambia de idioma cuando quieras — esta es la vista de anotaciones real que obtendrás para tus propios documentos, no una simulación.",
    },
    askAboutTerm: {
      prompt: "¿Aún tienes una pregunta sobre una palabra o frase en particular?",
      inputPlaceholder: "Escribe o pega un término del documento",
    },
    explainPopover: {
      explainQuoted: 'Explicar "{text}"',
    },
    howItWorks: {
      pageTitle: "Cómo funciona esto, y por qué tu documento está seguro",
      pipeline: {
        heading: "Qué sucede con tu documento",
        steps: [
          "Subes un informe de estudio o una nota médica como PDF.",
          "El texto se extrae del PDF en nuestro servidor, y los datos identificativos — nombre, fecha de nacimiento, números de identificación, dirección — se detectan y eliminan automáticamente. Esto ocurre de inmediato, antes que cualquier otra cosa.",
          "Solo ese texto reducido y sin datos identificativos se muestra a la IA. Nunca ve el archivo original, tu nombre, ni ningún otro dato identificativo.",
          "La IA identifica los hallazgos clave y los contrasta con investigación médica publicada real — nunca se le permite citar una fuente que no esté en esa lista real y recuperada.",
          "Ves una explicación en lenguaje sencillo de cada hallazgo, junto a tu documento original, en tu idioma preferido.",
        ],
        calloutTitle: "Una distinción importante",
        calloutBody:
          "El visor de documentos (paso 5) siempre muestra **tu archivo original, exactamente como lo subiste** — es tu documento, privado para tu cuenta, así que no hay razón para ocultártelo. La versión con datos eliminados es una copia aparte que solo existe para que la IA la lea. Nada de lo que ves cambia; lo que cambia es lo que la IA puede llegar a ver.",
      },
      doesDoesnt: {
        heading: "Qué hace esta herramienta — y qué no hace",
        intro:
          "Leer un documento no es lo mismo que interpretarlo. Un chatbot de IA genérico también podría explicar un informe así — y también, con total confianza, inventaría una cita que no existe, y vería tu documento tal como está escrito, con los datos identificativos incluidos. Esta herramienta está diseñada para hacer solo la primera parte, y para eliminar los datos identificativos antes de que la IA vea nada:",
        doesTitle: "Qué hace",
        doesItems: [
          "Coloca una explicación en lenguaje sencillo junto a cada término que el informe supone que ya conoces.",
          "Te muestra a qué frase pertenece cada explicación — pasa el cursor o toca una y la otra se ilumina.",
          "Escribe en inglés, español o chino tradicional a partir del mismo documento de origen.",
          "Enlaza cada explicación con investigación real y recuperada que puedes abrir y leer tú mismo.",
        ],
        doesntTitle: "Qué no hace",
        doesntItems: [
          "No te dice lo que tus resultados significan para ti.",
          "No diagnostica, estadifica, puntúa ni predice nada.",
          "No recomienda tratamiento, ni te dice si preocuparte.",
          "No cita lo que no te puede mostrar — si no se encontró ningún artículo, lo indica.",
        ],
      },
      demo: {
        heading: "Compruébalo tú mismo",
        intro:
          "Este es un ejemplo ficticio — no es un paciente real — que muestra exactamente lo que hace el paso de eliminación de datos antes de que algo llegue a la IA. Tu propio visor de documentos seguiría mostrando la versión de la izquierda; solo la IA ve la de la derecha.",
        beforeLabel: "Lo que subes — y lo que siempre ves",
        afterLabel: "Lo que la IA realmente ve",
        caption:
          "Observa lo que queda: el hallazgo médico real (\"nódulo de 2.1 cm... sugestivo de malignidad\") permanece totalmente legible — solo se eliminan los datos que identifican _a quién_ pertenece el documento.",
      },
      access: {
        heading: "Acceso y privacidad — pequeño a propósito",
        intro: "Esta herramienta se creó para que una familia lea sus propios informes, y está dimensionada así.",
        inviteOnlyTitle: "Solo por invitación",
        inviteOnlyBody: "No hay página de registro. Una dirección debe estar en la lista de invitados antes de poder iniciar sesión.",
        noPasswordsTitle: "Sin contraseñas",
        noPasswordsBody:
          "Ingresa tu correo y llega un enlace de acceso de un solo uso, válido por quince minutos. Nada que recordar, nada que se pueda filtrar.",
        yoursTitle: "Tus documentos siguen siendo tuyos",
        yoursBody: "Las subidas son privadas para la cuenta que las hizo, y no las puede ver ningún otro usuario.",
      },
      hipaa: {
        heading: 'Qué significa realmente ser "compatible con HIPAA"',
        intro:
          "HIPAA es la ley estadounidense que regula cómo debe protegerse la información de salud. Cumplirla no es activar un solo interruptor — es un conjunto de salvaguardas independientes que deben cumplirse todas a la vez:",
        items: [
          {
            strong: 'Un acuerdo firmado (un "BAA") con cada proveedor que toca datos de salud',
            rest: "— los hace legalmente responsables de protegerlos también, no solo a ti.",
          },
          {
            strong: "Cifrado",
            rest: "— codificar los datos tanto cuando están almacenados como cuando se mueven entre sistemas, para que sean ilegibles si llegan a interceptarse.",
          },
          {
            strong: "Controles de acceso",
            rest: "— solo sistemas y personas específicas y autorizadas pueden leer los datos, y solo lo que realmente necesitan.",
          },
          {
            strong: "Registro de auditoría",
            rest: "— un registro de exactamente quién o qué accedió a un dato, y cuándo.",
          },
          {
            strong: "Notificación de brechas",
            rest: "— la obligación legal de avisar a las personas afectadas si sus datos llegan a exponerse.",
          },
        ],
      },
      roadmap: {
        heading: "Hacia dónde vamos",
        intro:
          "Estamos construyendo activamente toda la infraestructura anterior como parte de una migración a Google Cloud. Parte de ella ya protege tus documentos hoy; el resto es trabajo real, en curso — aún no terminado, y preferimos decirlo con claridad en lugar de dar a entender lo contrario.",
        activeNow: "Activo ahora",
        inProgress: "En curso",
        items: [
          {
            status: "live",
            title: "Eliminación de datos antes de que la IA vea tu documento",
            detail: "Nuestro propio sistema encuentra y elimina automáticamente los datos identificativos en cada carga.",
          },
          {
            status: "live",
            title: "Google Cloud DLP como segunda capa de detección independiente",
            detail: "El escáner estándar de identificadores de Google, que funciona junto a nuestro sistema, no en su lugar.",
          },
          {
            status: "live",
            title: "Almacenamiento cifrado con claves que controlamos nosotros",
            detail: "Los documentos se cifran en reposo usando nuestras propias claves de cifrado gestionadas, no solo las predeterminadas del proveedor.",
          },
          {
            status: "live",
            title: "Una base de datos sin punto de entrada público",
            detail: "La base de datos que almacena tu cuenta y tus resultados es inalcanzable desde internet abierto, sin excepción.",
          },
          {
            status: "live",
            title: "Un backend de IA empresarial en lugar de uno de consumo",
            detail:
              "Funciona sobre la oferta de IA empresarial de Google en lugar de la API de consumo, que no entrena sus modelos con tus datos y es apta para un acuerdo formal de datos de salud.",
          },
          {
            status: "live",
            title: "Un registro de auditoría completo",
            detail: "Un registro de exactamente cuándo y cómo se accedió a cada documento.",
          },
          {
            status: "progress",
            title: "Un firewall de aplicaciones web",
            detail: "Bloqueo automático de patrones de ataque comunes antes de que lleguen a la aplicación.",
          },
          {
            status: "progress",
            title: "Un Acuerdo de Asociado Comercial (BAA) firmado",
            detail: "Un acuerdo legal formal con nuestro proveedor de nube — la última pieza, y la que hace que todo lo demás cuente.",
          },
        ],
      },
      goodToKnow: {
        heading: "Bueno saberlo",
        body:
          'Esta aplicación es solo por invitación, creada para un pequeño círculo de familiares y amigos — todavía no funciona como un sistema hospitalario certificado, precisamente por las razones de la lista anterior. Las protecciones marcadas como "Activo ahora" son reales y funcionan en cada carga, hoy mismo. Si alguna vez tienes dudas, está perfectamente bien tachar o eliminar tú mismo cualquier dato antes de subir el documento.',
      },
      detailsSummary: "Más información: cómo funcionan las dos capas de eliminación de datos",
      details: {
        layer1Title: "Capa 1 — Google Cloud DLP",
        layer1Body:
          "El servicio de Prevención de Pérdida de Datos de Google busca identificadores estándar — nombres completos, números de teléfono, correos electrónicos, números de seguro social, direcciones, fechas — usando detectores que Google construye y mantiene para una enorme variedad de tipos de documentos. Es generalista: cobertura amplia de identificadores que aparecen en casi cualquier tipo de documento, médico o no.",
        layer2Title: "Capa 2 — Nuestro propio sistema de eliminación de datos",
        layer2Intro: "Tres técnicas, combinadas:",
        layer2Items: [
          {
            strong: "Campos etiquetados",
            rest: '— todo lo que sigue a un encabezado como "Nombre del paciente:", "Fecha de nacimiento:", "Número de expediente:" o "Dirección:" se elimina automáticamente.',
          },
          {
            strong: "Menciones narrativas",
            rest: '— frases como "El paciente Juan Pérez presenta..." se reconocen y se eliminan incluso fuera de un campo etiquetado.',
          },
          {
            strong: "Reconocimiento de texto médico",
            rest: "— un modelo entrenado para reconocer nombres, lugares y fechas dentro de oraciones comunes detecta lo que las dos primeras técnicas pasan por alto.",
          },
        ],
        whyTwoLayers:
          "**¿Por qué dos capas?** Ningún método por sí solo lo detecta todo. Un escáner genérico de identificadores (Capa 1) puede pasar por alto un nombre incrustado en una redacción médica poco común que los patrones específicos de la Capa 2 sí detectan — y la Capa 2, creada específicamente para documentos clínicos, no sabe buscar cosas como números de tarjetas de crédito de la forma en que lo hace un escáner genérico. Usar ambas significa que el punto ciego de una capa suele ser la fortaleza de la otra.",
      },
    },
    tour: {
      ctaButton: "Hacer el recorrido de 2 minutos",
      replayLink: "Repetir el recorrido",
      sampleDocumentTitle: "Informe de muestra (recorrido guiado)",
      stepCounter: ({ step, total }) => `Paso ${step} de ${total}`,
      back: "Atrás",
      next: "Siguiente",
      skip: "Omitir recorrido",
      done: "Listo",
      steps: [
        {
          title: "Echemos un vistazo real",
          body: "Este es un informe de muestra real y sintético — no una simulación. Todo lo que estás a punto de probar (resaltado, explicaciones, cambio de idioma) es el producto real, funcionando de verdad.",
        },
        {
          title: "Pasa el cursor para ver la explicación",
          body: "Pasa el cursor o toca una frase resaltada en el documento, o una de las explicaciones a la izquierda — la otra se ilumina. Así es como un término y su explicación en lenguaje sencillo quedan conectados.",
        },
        {
          title: "Explicaciones, una junto a otra",
          body: "Cada hallazgo recibe una explicación en lenguaje sencillo, respaldada por investigación real y recuperada que puedes abrir y leer tú mismo.",
        },
        {
          title: "Selecciona cualquier frase para preguntar por ella",
          body: 'Pruébalo ahora: selecciona la frase "adrenal glands" en el documento y luego haz clic en "Explicar" — esto le pregunta a la IA real, en el momento, igual que lo haría con tu propio informe.',
        },
        {
          title: "Léelo en tu idioma",
          body: "Este control gobierna todo el sitio, incluido este mismo informe — prueba inglés, español o chino tradicional.",
        },
        {
          title: "O simplemente escríbelo",
          body: "¿No ves la palabra que te genera curiosidad? Escríbela o pégala aquí en lugar de seleccionarla en el documento.",
        },
        {
          title: "¿Listo para tu propio informe?",
          body: 'Haz clic en "← Volver a los documentos" cuando quieras, y luego agrega un informe real tuyo desde el panel principal.',
        },
      ],
    },
  },

  "zh-Hant": {
    common: {
      disclaimer:
        "本工具不提供醫療建議，僅協助解釋文件中的客觀內容——解讀結果與照護決定請務必諮詢合格的醫療人員。",
      signOut: "登出",
      backToDocuments: "← 返回文件列表",
      back: "← 返回",
      loading: "載入中…",
      openInNewTab: "在新分頁開啟",
      noSourceFound: "找不到明確的參考來源。",
      tryAgain: "再試一次",
      gotIt: "了解",
      explain: "解釋",
      explaining: "說明中…",
    },
    signIn: {
      checkEmailTitle: "請查看你的電子郵件",
      checkEmailBody: "我們已將登入連結寄至 **{email}**。請在此裝置上開啟連結以完成登入。",
      sessionExpired:
        "你已被登出——如果你在其他分頁或裝置登出，可能會發生這種情況（同一帳號共用一組登入狀態）。請重新登入。",
      heroEyebrow: "掃描報告與醫師筆記",
      heroTitle: "寫給醫師看的內容，為你解釋清楚。",
      heroSub:
        "上傳報告，即可在旁邊看到報告中每個術語的白話解釋——支援**英文、西班牙文或繁體中文**，並附上每項解釋背後已發表研究的連結。",
      inviteOnlyNotice: "此應用程式僅限受邀使用。請輸入受邀電子郵件以取得登入連結。",
      emailPlaceholder: "you@example.com",
      sendLink: "傳送登入連結給我",
      sending: "傳送中…",
      footer: "由 Jonathan Yuen 製作（{email}）——歡迎提出任何問題。",
    },
    dashboard: {
      signedInAs: "以 {email} 登入",
      welcomeBack: "歡迎回來，",
      welcome: "歡迎，",
      greetingEmpty: "在下方新增你的第一份報告，看看它如何運作。",
      nothingNew: "自上次造訪以來沒有新內容。",
      reportsReady: ({ n }) => `${n} 份報告已可閱讀。`,
      moreProcessing: ({ n }) => `另外 ${n} 份仍在生成說明——不需要在旁等候。`,
      couldntProcessed: ({ n }) => `${n} 份無法處理——你可以移除後重試。`,
      addReportTitle: "新增報告",
      addReportLead: "檢驗結果、掃描報告或醫師筆記——皆須為 PDF 檔。",
      uploading: "上傳中…",
      dropHint: "將 PDF 拖放到此處，或",
      chooseFile: "選擇檔案",
      commonQuestions: "常見問題",
      q1: "我要去哪裡取得 PDF？",
      a1: "在 MyChart 或 LiveWell 中開啟結果，選擇「下載」或印表機圖示，並存成 PDF。若使用手機，點選「分享」再選「儲存到檔案」即可。",
      q2: "誰能看到我新增的內容？",
      a2: "只有你。你的姓名、出生日期與病歷號碼，會在送出說明之前先被移除。",
      q3: "需要多久時間？",
      a3: "大約一分鐘。你可以先關閉頁面，稍後再回來查看。",
      q4: "它會告訴我哪裡有問題嗎？",
      a4: "不會。它只解釋文字的意思。你的結果對你代表什麼，請與你的醫師討論。",
      howLink: "了解運作方式，以及你的文件如何受到保護 →",
      yourReports: "你的報告",
      reportsCount: ({ n }) => `${n} 份報告．最新在前`,
      loadingDocuments: "正在載入文件…",
      emptyState: "目前尚無報告——新增第一份看看它如何運作。",
      readExplanation: "閱讀說明",
      moreActionsFor: "{name} 的更多操作",
      rename: "重新命名",
      delete: "刪除",
      deleteConfirm: "刪除這份文件？此動作無法復原。",
      renamePrompt: "重新命名文件：",
      addedOn: "新增於 {date}",
      statusReady: "說明已完成",
      statusProcessing: "仍在處理中",
      statusFailed: "無法處理",
    },
    documentViewer: {
      generatingAnnotations: "正在生成說明……第一次可能需要一點時間。",
      theseAreTerms:
        "以下是我們認為最需要解釋的術語。沒看到你想了解的內容嗎？可以選取文件中的其他文字，或在下方輸入，同樣可以詢問。",
      originalDocument: "原始文件",
      loadingDocument: "正在載入文件…",
      originalNote: "這是你上傳的原始檔案，完全保留原樣。送給 AI 看的，只有另一份姓名等個人資訊已被塗黑的副本。",
      whySummary: "為什麼這裡還看得到我的姓名等個人資訊？",
      whyBody:
        "PlainMed 從不會編輯或隱藏你在這裡看到的文件內容——這是你帳號專屬的私人文件，沒有理由要對你隱藏。在 AI 讀取你的報告之前，系統會另外建立一份暫時的副本，將姓名、出生日期等識別資訊塗黑，只有這份精簡副本會送交 AI。你在這個畫面上看到的檔案，從未被更動過。",
      whyLink: "查看完整運作說明 →",
    },
    demoPreview: {
      ariaLabel: "文件說明方式範例",
      sampleReportLabel: "範例報告——合成資料，非真實病患",
      originalDocumentAlways: "原始文件——始終保留原文語言",
      hint: "將滑鼠移到或點選反白的詞句，也可以隨時切換語言——這就是你自己的文件會看到的實際標註畫面，並非示意圖。",
    },
    askAboutTerm: {
      prompt: "對某個字詞或片語還有疑問嗎？",
      inputPlaceholder: "輸入或貼上文件中的術語",
    },
    explainPopover: {
      explainQuoted: "解釋「{text}」",
    },
    howItWorks: {
      pageTitle: "運作方式，以及你的文件為何安全",
      pipeline: {
        heading: "你的文件會經歷什麼",
        steps: [
          "你以 PDF 格式上傳掃描報告或醫師筆記。",
          "文字會在我們的伺服器上從 PDF 擷取出來，姓名、出生日期、證件號碼、地址等識別資訊會自動被找出並移除。這在任何其他步驟之前就會立即完成。",
          "AI 只會看到這份去識別化、精簡過的文字，永遠不會看到原始檔案、你的姓名，或任何其他識別資訊。",
          "AI 會挑出關鍵發現，並與真實已發表的醫學研究比對——絕不允許引用不在該真實檢索清單中的來源。",
          "你會看到每項發現的白話解釋，與原始文件並排呈現，並使用你偏好的語言。",
        ],
        calloutTitle: "一個重要的區別",
        calloutBody:
          "文件檢視器（步驟 5）一律顯示**你上傳時原本的檔案**——這是你的文件，僅限你的帳號存取，沒有理由要對你隱藏。去識別化的版本只是另外一份副本，僅供 AI 閱讀之用。你看到的內容不會改變；改變的是 AI 被允許看到什麼。",
      },
      doesDoesnt: {
        heading: "這項工具會做什麼——不會做什麼",
        intro:
          "閱讀文件並不等於解讀文件。一般用途的 AI 聊天機器人也能解釋這類報告——但也可能很有自信地捏造一個根本不存在的引用來源，並看到你文件中未經去識別化的完整內容。這項工具的設計只做前者，並且在 AI 看到任何內容之前，先移除所有識別資訊：",
        doesTitle: "它會做的事",
        doesItems: [
          "在報告假設你已經知道的每個術語旁，附上白話解釋。",
          "顯示每項解釋對應到哪個詞句——將滑鼠移到或點選其中一個，另一個就會亮起。",
          "從同一份原始文件，以英文、西班牙文或繁體中文撰寫說明。",
          "將每項解釋連結到你可以自行開啟閱讀的真實檢索研究。",
        ],
        doesntTitle: "它不會做的事",
        doesntItems: [
          "不會告訴你檢查結果對你代表什麼。",
          "不會做診斷、分期、評分或預測。",
          "不會建議治療方式，也不會告訴你該不該擔心。",
          "不會引用它無法呈現給你看的來源——若找不到相關論文，會如實說明。",
        ],
      },
      demo: {
        heading: "親自體驗看看",
        intro:
          "以下是一個虛構範例——並非真實病患——用來展示去識別化步驟在任何內容送達 AI 之前實際做了什麼。你自己的文件檢視器仍會顯示左側版本；只有 AI 會看到右側版本。",
        beforeLabel: "你上傳的內容——也是你一直看到的版本",
        afterLabel: "AI 實際看到的內容",
        caption:
          "請注意保留下來的部分：真正的醫療發現（「2.1 公分結節……疑似惡性」）仍完整可讀——只有能識別文件屬於_誰_的資訊被移除。",
      },
      access: {
        heading: "存取與隱私——刻意維持小規模",
        intro: "這項工具是為了讓一個家庭閱讀自己的報告而打造，規模也因此設計得剛好如此。",
        inviteOnlyTitle: "僅限受邀",
        inviteOnlyBody: "沒有註冊頁面。電子郵件地址必須先列入受邀名單，才能登入。",
        noPasswordsTitle: "無需密碼",
        noPasswordsBody: "輸入你的電子郵件，即可收到一組僅限一次使用、十五分鐘內有效的登入連結。不必記住任何東西，也沒有東西會外洩。",
        yoursTitle: "你的文件永遠屬於你",
        yoursBody: "上傳的內容僅限建立該帳號的使用者存取，其他使用者一律看不到。",
      },
      hipaa: {
        heading: "「符合 HIPAA」實際上代表什麼",
        intro:
          "HIPAA 是美國規範健康資訊應如何受到保護的法律。符合規範並不是打開一個開關就好——而是一整套必須同時成立的獨立防護措施：",
        items: [
          {
            strong: "與每一家接觸健康資料的供應商簽署協議（「BAA」）",
            rest: "——讓對方也負起保護資料的法律責任，而不只是你自己。",
          },
          {
            strong: "加密",
            rest: "——無論資料儲存時或在系統間傳輸時都會加密，即使遭攔截也無法讀取。",
          },
          {
            strong: "存取控管",
            rest: "——只有特定、經授權的系統與人員可以讀取資料，且僅限於他們真正需要的部分。",
          },
          {
            strong: "稽核紀錄",
            rest: "——確實記錄是誰、或什麼系統，在何時存取了哪一筆資料。",
          },
          {
            strong: "外洩通報",
            rest: "——若資料曾遭外洩，依法必須通知受影響的人。",
          },
        ],
      },
      roadmap: {
        heading: "接下來的方向",
        intro:
          "我們正積極建置上述完整基礎架構，做為遷移至 Google Cloud 的一部分。其中部分已能保護你今天的文件；其餘則是仍在進行中的真實工作——尚未完成，我們寧可如實說明，也不願暗示已經完備。",
        activeNow: "現已啟用",
        inProgress: "進行中",
        items: [
          {
            status: "live",
            title: "在 AI 看到文件之前先完成去識別化",
            detail: "我們自有的系統會在每次上傳時自動找出並移除識別資訊。",
          },
          {
            status: "live",
            title: "以 Google Cloud DLP 做為第二道獨立偵測層",
            detail: "Google 業界標準的識別資訊掃描工具，與我們自有系統並行運作，而非取代它。",
          },
          {
            status: "live",
            title: "以自有金鑰進行加密儲存",
            detail: "文件會以我們自行管理的加密金鑰進行靜態加密，而非僅使用供應商預設值。",
          },
          {
            status: "live",
            title: "資料庫不具公開對外入口",
            detail: "儲存你帳號與結果的資料庫完全無法從公開網際網路存取。",
          },
          {
            status: "live",
            title: "採用企業級 AI 後端，而非消費級",
            detail: "運作於 Google 的企業級 AI 服務，而非消費級 API——不會用你的資料訓練模型，並符合正式健康資料協議的資格。",
          },
          {
            status: "live",
            title: "完整稽核紀錄",
            detail: "確實記錄每份文件何時、以何種方式被存取。",
          },
          {
            status: "progress",
            title: "網頁應用程式防火牆",
            detail: "在常見攻擊模式抵達應用程式之前自動加以攔截。",
          },
          {
            status: "progress",
            title: "簽署商業夥伴協議（BAA）",
            detail: "與雲端供應商簽署的正式法律協議——這是最後一塊拼圖，也是讓前述一切真正落實的關鍵。",
          },
        ],
      },
      goodToKnow: {
        heading: "小提醒",
        body:
          "這款應用程式僅限受邀使用，是為一小群親友打造的——目前尚未以合格醫療機構系統的規格運作，原因正是上方清單所列。標示「現已啟用」的防護措施都是真實運作、每次上傳都會套用的。如果你仍有疑慮，上傳前自行塗黑或移除任何細節，完全沒問題。",
      },
      detailsSummary: "深入了解：兩層去識別化如何運作",
      details: {
        layer1Title: "第一層 — Google Cloud DLP",
        layer1Body:
          "Google 的資料外洩防護（DLP）服務會掃描標準識別資訊——全名、電話號碼、電子郵件地址、社會安全號碼、街道地址、日期——所使用的偵測器由 Google 建置並維護，涵蓋範圍極廣的文件類型。它是通用型工具：能廣泛涵蓋幾乎任何類型文件（無論是否為醫療文件）中出現的識別資訊。",
        layer2Title: "第二層 — 我們自有的去識別化系統",
        layer2Intro: "結合三種技術：",
        layer2Items: [
          {
            strong: "標籤欄位",
            rest: "——任何跟在「病患姓名：」「出生日期：」「病歷號碼：」或「地址：」等標題後方的內容，都會自動移除。",
          },
          {
            strong: "敘述性提及",
            rest: "——像「病患王小明主訴……」這類措辭，即使出現在標籤欄位之外，也會被辨識並移除。",
          },
          {
            strong: "醫療文本辨識",
            rest: "——一個經過訓練、能在一般句子中辨識姓名、地點與日期的模型，能補足前兩種技術遺漏的部分。",
          },
        ],
        whyTwoLayers:
          "**為什麼要有兩層？** 沒有任何單一方法能涵蓋所有情況。通用型識別資訊掃描器（第一層）可能會漏掉隱藏在不常見醫療措辭中的姓名，而第二層針對醫療情境設計的模式正是為此而生——反過來，專為臨床文件打造的第二層，並不像通用掃描器那樣懂得留意信用卡號之類的資訊。同時執行兩層，代表其中一層的盲點，通常正是另一層的強項。",
      },
    },
    tour: {
      ctaButton: "開始兩分鐘導覽",
      replayLink: "重新導覽",
      sampleDocumentTitle: "範例報告（導覽用）",
      stepCounter: ({ step, total }) => `第 ${step} 步，共 ${total} 步`,
      back: "上一步",
      next: "下一步",
      skip: "跳過導覽",
      done: "完成",
      steps: [
        {
          title: "來實際看看吧",
          body: "這是一份真實的合成範例報告——不是示意圖。你即將嘗試的每一項功能（反白標註、說明、切換語言）都是真正在運作的產品本身。",
        },
        {
          title: "將滑鼠移到上面看看說明",
          body: "將滑鼠移到或點選文件中反白的詞句，或是左側的其中一項說明——另一邊就會跟著亮起。這就是術語與其白話說明彼此對應的方式。",
        },
        {
          title: "說明就在旁邊",
          body: "每項發現都附有白話解釋，並有你可以自行開啟閱讀的真實檢索研究作為依據。",
        },
        {
          title: "選取任何詞句來詢問",
          body: "現在試試看：在文件中選取「adrenal glands」這個詞組，然後點選「解釋」——這會即時詢問真正的 AI，就像處理你自己的報告時一樣。",
        },
        {
          title: "用你的語言閱讀",
          body: "這個切換鍵掌控整個網站，包括這份報告本身——試試英文、西班牙文或繁體中文。",
        },
        {
          title: "或者直接輸入",
          body: "沒看到你好奇的詞嗎？可以直接在這裡輸入或貼上，不必在文件中選取。",
        },
        {
          title: "準備好上傳你自己的報告了嗎？",
          body: "準備好後，點選「← 返回文件列表」，接著就可以從主頁新增一份屬於你自己的真實報告。",
        },
      ],
    },
  },
};
