/**
 * modules/planner/planner.js
 */
const PlannerModule = {
    currentPlan: { id: null, name: '', notes: '', playbookIds: [] },
    allPlaybooks: [],

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open();
        this.loadGrid();
    },

    cacheDOM() {
        this.grid = document.getElementById('planner-grid');
        this.modal = document.getElementById('plan-editor-modal');
        this.selectorList = document.getElementById('selector-list');
        this.planList = document.getElementById('plan-playbooks-list');
    },

    bindEvents() {
        document.getElementById('plan-editor-close').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('plan-cancel').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('plan-save').onclick = () => this.savePlan();
        
        document.getElementById('selector-search').oninput = (e) => this.filterSelector(e.target.value);
    },

    async loadGrid() {
        const plans = await orbDB.getAllPlans();
        this.grid.innerHTML = '<div class="card-new-plan" id="btn-new-plan">+ Nouveau Plan</div>';
        
        plans.reverse().forEach(plan => {
            const card = document.createElement('div');
            card.className = 'plan-card';
            card.innerHTML = `
                <h3>${plan.name}</h3>
                <p>${plan.playbookIds.length} exercices</p>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <button class="btn-primary" onclick="PlannerModule.editPlan(${plan.id})">Modifier</button>
                    <button class="danger" onclick="PlannerModule.deletePlan(${plan.id})">Supprimer</button>
                </div>
            `;
            this.grid.appendChild(card);
        });

        document.getElementById('btn-new-plan').onclick = () => this.openEditor();
    },

    async openEditor(plan = null) {
        this.allPlaybooks = await orbDB.getAllPlaybooks();
        this.currentPlan = plan ? { ...plan } : { id: null, name: '', notes: '', playbookIds: [] };
        
        document.getElementById('plan-name').value = this.currentPlan.name;
        document.getElementById('plan-notes').value = this.currentPlan.notes;
        
        this.renderSelector();
        this.renderPlanExos();
        this.modal.classList.remove('hidden');
    },

    renderSelector() {
        this.selectorList.innerHTML = '';
        this.allPlaybooks.forEach(pb => {
            const item = document.createElement('div');
            item.className = 'selector-item';
            item.innerHTML = `<span>${pb.name}</span>`;
            item.onclick = () => {
                this.currentPlan.playbookIds.push(pb.id);
                this.renderPlanExos();
            };
            this.selectorList.appendChild(item);
        });
    },

    renderPlanExos() {
        this.planList.innerHTML = '';
        this.currentPlan.playbookIds.forEach((id, index) => {
            const pb = this.allPlaybooks.find(p => p.id === id);
            if (!pb) return;
            const li = document.createElement('li');
            li.className = 'plan-playbook-item';
            li.innerHTML = `
                <span>${pb.name}</span>
                <button class="danger" onclick="PlannerModule.removeExo(${index})">×</button>
            `;
            this.planList.appendChild(li);
        });
    },

    removeExo(index) {
        this.currentPlan.playbookIds.splice(index, 1);
        this.renderPlanExos();
    },

    async savePlan() {
        this.currentPlan.name = document.getElementById('plan-name').value;
        this.currentPlan.notes = document.getElementById('plan-notes').value;
        await orbDB.savePlan(this.currentPlan, this.currentPlan.id);
        this.modal.classList.add('hidden');
        this.loadGrid();
    },

    async editPlan(id) {
        const plan = await orbDB.getPlan(id);
        this.openEditor(plan);
    },

    async deletePlan(id) {
        if(confirm("Supprimer ce plan ?")) {
            await orbDB.deletePlan(id);
            this.loadGrid();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => PlannerModule.init());