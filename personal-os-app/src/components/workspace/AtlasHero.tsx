import Link from "next/link";
import { KnowledgeOrbit } from "./KnowledgeOrbit";
import { Icon } from "./Icons";
export function AtlasHero() {
  return <section className="os-atlas-hero" aria-label="知识与行动">
    <div className="os-atlas-copy"><div className="os-atlas-kicker"><span className="os-kicker-rule" /> 个人知识与协作系统 <span className="os-edition">知 / 行</span></div>
      <h2>让知识生长，<br /><span>让行动有迹。</span></h2>
      <p>把零散的灵感，变成有依据的知识。<br />把明确的目标，推进到可验证的交付。</p>
      <div className="os-atlas-actions"><Link href="/tasks" className="os-btn os-btn-primary">进入任务中心 <Icon name="arrow" size={17} /></Link><Link href="/wiki" className="os-atlas-secondary">翻阅知识手册 <Icon name="external" size={16} /></Link></div>
    </div><KnowledgeOrbit />
    <div className="os-atlas-bottom"><span><i>01</i> 收集灵感</span><b /><span><i>02</i> 沉淀知识</span><b /><span><i>03</i> 推进行动</span><span className="os-atlas-bottom-note">从想法，到下一步。</span></div>
  </section>;
}
