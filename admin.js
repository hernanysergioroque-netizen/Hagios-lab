// Painel HAGIOS Lab ligado ao Supabase. Sem armazenamento de projectos em localStorage.
(() => {
    const cfg = window.HAGIOS_CONFIG || {};
    const configured = cfg.supabaseUrl && cfg.supabaseAnonKey &&
        !cfg.supabaseUrl.includes('COLOCA_AQUI') && !cfg.supabaseAnonKey.includes('COLOCA_AQUI');
    const setupNotice = document.querySelector('#setupNotice');
    const loginSection = document.querySelector('#loginSection');
    const adminWorkspace = document.querySelector('#adminWorkspace');
    const loginForm = document.querySelector('#loginForm');
    const loginMessage = document.querySelector('#loginMessage');
    const loginButton = document.querySelector('#loginButton');
    const projectForm = document.querySelector('#projectForm');
    const projectsList = document.querySelector('#projectsList');
    const formMessage = document.querySelector('#formMessage');
    const submitButton = document.querySelector('#submitProject');
    const cancelButton = document.querySelector('#cancelEdit');
    const databaseMessage = document.querySelector('#databaseMessage');
    const backupFile = document.querySelector('#backupFile');
    let supabase = null;
    let projects = [];
    let editingId = null;

    function showMessage(element, message, success = true) {
        element.textContent = message;
        element.style.color = success ? '#168653' : '#b42318';
    }
    function escapeHTML(value = '') {
        return String(value).replace(/[&<>\'\"]/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[character]));
    }
    function fromRow(row) {
        return { id: row.id, name: row.name || '', description: row.description || '', category: row.category || 'Outro', image: row.image_url || '', link: row.project_url || '', isPublished: row.is_published, updatedAt: row.updated_at };
    }
    function toRow(project) {
        const row = { name: project.name.trim(), description: project.description.trim(), category: project.category, image_url: project.image.trim(), project_url: project.link.trim(), is_published: project.isPublished !== false, updated_at: new Date().toISOString() };
        if (project.id) row.id = project.id;
        return row;
    }
    function resetEditor() {
        editingId = null;
        projectForm.reset();
        submitButton.textContent = 'Adicionar projeto';
        cancelButton.hidden = true;
    }
    function renderProjects() {
        projectsList.innerHTML = '';
        if (!projects.length) {
            projectsList.innerHTML = '<p class="empty-message">Ainda não existem projectos na base de dados.</p>';
            return;
        }
        projects.forEach(project => {
            const card = document.createElement('article');
            card.className = 'project-card';
            card.innerHTML = `
                <h3>${escapeHTML(project.name)}</h3>
                <p>${escapeHTML(project.description)}</p>
                <p><strong>Categoria:</strong> ${escapeHTML(project.category)}</p>
                <p><strong>Estado:</strong> ${project.isPublished ? 'Publicado' : 'Rascunho'}</p>
                ${project.image ? `<p><strong>Imagem:</strong> <a href="${escapeHTML(project.image)}" target="_blank" rel="noopener noreferrer">Ver imagem</a></p>` : ''}
                ${project.link ? `<p><a href="${escapeHTML(project.link)}" target="_blank" rel="noopener noreferrer">Abrir projecto</a></p>` : ''}
                <div class="project-actions">
                    <button type="button" class="edit-btn" data-action="edit" data-id="${escapeHTML(project.id)}">Editar</button>
                    <button type="button" class="edit-btn" data-action="toggle" data-id="${escapeHTML(project.id)}">${project.isPublished ? 'Despublicar' : 'Publicar'}</button>
                    <button type="button" class="delete-btn" data-action="delete" data-id="${escapeHTML(project.id)}">Apagar projecto</button>
                </div>`;
            projectsList.appendChild(card);
        });
    }
    async function loadProjects() {
        projectsList.innerHTML = '<p class="empty-message">A carregar projectos...</p>';
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (error) {
            projectsList.innerHTML = '<p class="empty-message">Não foi possível carregar os projectos.</p>';
            showMessage(databaseMessage, `Erro ao carregar projectos: ${error.message}`, false);
            return;
        }
        projects = (data || []).map(fromRow);
        renderProjects();
        showMessage(databaseMessage, `${projects.length} projecto(s) carregado(s) da base de dados.`);
    }
    async function applySession(session) {
        if (!session) {
            loginSection.hidden = false;
            adminWorkspace.hidden = true;
            return;
        }
        const { data: isAdmin, error } = await supabase.rpc('is_hagios_admin');
        if (error || isAdmin !== true) {
            showMessage(loginMessage, 'Esta conta não tem permissão de administrador. Confirma que o UUID foi adicionado à tabela hagios_admins.', false);
            await supabase.auth.signOut();
            loginSection.hidden = false;
            adminWorkspace.hidden = true;
            return;
        }
        loginSection.hidden = true;
        adminWorkspace.hidden = false;
        await loadProjects();
    }
    async function checkSession() {
        if (!configured || !window.supabase) {
            setupNotice.hidden = false;
            loginSection.hidden = true;
            adminWorkspace.hidden = true;
            return;
        }
        supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const { data: { session } } = await supabase.auth.getSession();
        await applySession(session);
        supabase.auth.onAuthStateChange((_event, sessionNow) => {
            setTimeout(() => applySession(sessionNow), 0);
        });
    }

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!supabase) return;
        loginButton.disabled = true;
        showMessage(loginMessage, 'A entrar...');
        const { error } = await supabase.auth.signInWithPassword({
            email: document.querySelector('#adminEmail').value.trim(),
            password: document.querySelector('#adminPassword').value
        });
        loginButton.disabled = false;
        if (error) showMessage(loginMessage, `Não foi possível entrar: ${error.message}`, false);
        else showMessage(loginMessage, 'Sessão iniciada.');
    });
    document.querySelector('#logoutButton').addEventListener('click', async () => {
        if (supabase) await supabase.auth.signOut();
    });

    projectForm.addEventListener('submit', async event => {
        event.preventDefault();
        const project = {
            name: document.querySelector('#projectName').value.trim(),
            description: document.querySelector('#projectDescription').value.trim(),
            category: document.querySelector('#projectCategory').value.trim(),
            image: document.querySelector('#projectImage').value.trim(),
            link: document.querySelector('#projectLink').value.trim(),
            isPublished: true
        };
        if (!project.name || !project.description || !project.category) {
            showMessage(formMessage, 'Preenche os campos obrigatórios.', false); return;
        }
        submitButton.disabled = true;
        let result;
        if (editingId) {
            result = await supabase.from('projects').update(toRow({ ...project, id: editingId })).eq('id', editingId);
        } else {
            result = await supabase.from('projects').insert(toRow(project));
        }
        submitButton.disabled = false;
        if (result.error) {
            showMessage(formMessage, `Não foi possível guardar: ${result.error.message}`, false); return;
        }
        showMessage(formMessage, editingId ? 'Projecto actualizado na base de dados.' : 'Projecto adicionado à base de dados.');
        resetEditor(); await loadProjects();
    });

    projectsList.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const project = projects.find(item => item.id === button.dataset.id);
        if (!project) return;
        if (button.dataset.action === 'edit') {
            editingId = project.id;
            document.querySelector('#projectName').value = project.name;
            document.querySelector('#projectDescription').value = project.description;
            document.querySelector('#projectCategory').value = project.category;
            document.querySelector('#projectImage').value = project.image;
            document.querySelector('#projectLink').value = project.link;
            submitButton.textContent = 'Guardar alterações'; cancelButton.hidden = false;
            showMessage(formMessage, `A editar: ${project.name}`);
            projectForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (button.dataset.action === 'delete') {
            if (!confirm(`Tens a certeza de que queres apagar definitivamente o projecto "${project.name}"?`)) return;
            const { error } = await supabase.from('projects').delete().eq('id', project.id);
            if (error) showMessage(formMessage, `Erro ao apagar: ${error.message}`, false);
            else { if (editingId === project.id) resetEditor(); showMessage(formMessage, 'Projecto apagado da base de dados.'); await loadProjects(); }
        } else if (button.dataset.action === 'toggle') {
            const { error } = await supabase.from('projects').update({ is_published: !project.isPublished, updated_at: new Date().toISOString() }).eq('id', project.id);
            if (error) showMessage(formMessage, `Erro ao alterar publicação: ${error.message}`, false);
            else { showMessage(formMessage, project.isPublished ? 'Projecto despublicado.' : 'Projecto publicado.'); await loadProjects(); }
        }
    });

    function downloadFile(filename, content, type) {
        const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    }
    document.querySelector('#exportJson').addEventListener('click', () => {
        const backup = { app: 'HAGIOS Lab', formatVersion: 2, exportedAt: new Date().toISOString(), projects };
        downloadFile(`hagios-projetos-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
        showMessage(databaseMessage, `Cópia JSON descarregada (${projects.length} projecto(s)).`);
    });
    document.querySelector('#exportCsv').addEventListener('click', () => {
        const columns = ['id', 'name', 'description', 'category', 'image', 'link', 'isPublished', 'updatedAt'];
        const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [columns.map(csvCell).join(';'), ...projects.map(project => columns.map(column => csvCell(project[column])).join(';'))];
        downloadFile(`hagios-projetos-${new Date().toISOString().slice(0, 10)}.csv`, '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8');
        showMessage(databaseMessage, `Lista CSV descarregada (${projects.length} projecto(s)).`);
    });
    document.querySelector('#importBackup').addEventListener('click', () => backupFile.click());
    backupFile.addEventListener('change', async () => {
        const file = backupFile.files && backupFile.files[0]; if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            const imported = Array.isArray(parsed) ? parsed : parsed.projects;
            if (!Array.isArray(imported)) throw new Error('Formato inválido');
            const cleaned = imported.map(project => ({
                ...(project.id && /^[0-9a-f-]{36}$/i.test(project.id) ? { id: project.id } : {}),
                name: String(project.name || '').trim(), description: String(project.description || '').trim(),
                category: String(project.category || 'Outro').trim(), image_url: String(project.image_url ?? project.image ?? '').trim(),
                project_url: String(project.project_url ?? project.link ?? '').trim(), is_published: project.isPublished !== false && project.is_published !== false,
                updated_at: new Date().toISOString()
            }));
            if (cleaned.some(project => !project.name || !project.description || !project.category)) throw new Error('Campos obrigatórios em falta');
            if (!confirm(`Importar ${cleaned.length} projecto(s) para a base de dados? Os IDs coincidentes serão actualizados; os restantes serão adicionados.`)) return;
            const { error } = await supabase.from('projects').upsert(cleaned);
            if (error) throw error;
            await loadProjects(); showMessage(databaseMessage, `Importação concluída: ${cleaned.length} projecto(s).`);
        } catch (error) {
            showMessage(databaseMessage, `Não foi possível importar a cópia: ${error.message || 'ficheiro inválido'}`, false);
        } finally { backupFile.value = ''; }
    });
    document.querySelector('#deleteAll').addEventListener('click', async () => {
        if (!projects.length) { showMessage(databaseMessage, 'A base de dados já não tem projectos.', false); return; }
        const confirmation = prompt(`Isto vai apagar definitivamente os ${projects.length} projectos da base de dados. Escreve APAGAR para confirmar.`);
        if (confirmation !== 'APAGAR') { showMessage(databaseMessage, 'Operação cancelada.', false); return; }
        const { error } = await supabase.from('projects').delete().not('id', 'is', null);
        if (error) showMessage(databaseMessage, `Não foi possível apagar: ${error.message}`, false);
        else { resetEditor(); await loadProjects(); showMessage(databaseMessage, 'Todos os projectos foram apagados da base de dados.'); }
    });
    cancelButton.addEventListener('click', resetEditor);
    checkSession().catch(error => showMessage(loginMessage, `Erro de configuração: ${error.message}`, false));
})();
