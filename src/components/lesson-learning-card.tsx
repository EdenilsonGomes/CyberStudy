import { BookOpen, GitCompareArrows, Lightbulb, ListChecks, MessageCircleQuestion, Sparkles } from "lucide-react";
import type { LessonLearningCard } from "@/db/schema";

const cardMeta = {
  CONCEPT: { label: "Entenda o conceito", icon: Lightbulb },
  ANALOGY: { label: "Pense assim", icon: Sparkles },
  COMPARISON: { label: "Compare", icon: GitCompareArrows },
  STEPS: { label: "Passo a passo", icon: ListChecks },
  SCENARIO: { label: "Veja na prática", icon: MessageCircleQuestion },
} as const;

type LessonLearningCardProps = {
  card: LessonLearningCard;
  selectedItem: number;
  onSelectItem: (index: number) => void;
};

export function LessonLearningCardView({ card, selectedItem, onSelectItem }: LessonLearningCardProps) {
  const meta = cardMeta[card.type] || { label: "Aprenda", icon: BookOpen };
  const Icon = meta.icon;
  const items = (card.items || []).slice(0, 4);
  const activeItem = items[Math.min(selectedItem, Math.max(items.length - 1, 0))];

  return <article className={`learning-card learning-card-${card.type.toLowerCase()}`}>
    <header className="learning-card-head">
      <span className="learning-card-icon"><Icon size={19}/></span>
      <div className="min-w-0">
        <p className="learning-card-eyebrow">{card.eyebrow || meta.label}</p>
        <h1>{card.title}</h1>
      </div>
    </header>

    <div className="learning-card-visual" aria-hidden="true">
      <i/><i/><i/>
      <span>{card.emoji || <Icon size={42}/>}</span>
    </div>

    {card.body && <p className="learning-card-copy">{card.body}</p>}

    {card.type === "COMPARISON" && items.length > 0 && <div className="learning-compare">
      <div className="learning-compare-tabs" role="group" aria-label="Itens para comparar">
        {items.map((item, index) => <button type="button" key={`${item.label}-${index}`} onClick={() => onSelectItem(index)} className={index === selectedItem ? "learning-compare-active" : ""} aria-pressed={index === selectedItem}>
          <span aria-hidden="true">{item.emoji || "◆"}</span><strong>{item.label}</strong>
        </button>)}
      </div>
      {activeItem && <div className="learning-compare-detail"><span aria-hidden="true">{activeItem.emoji || "◆"}</span><div><strong>{activeItem.label}</strong><p>{activeItem.description}</p></div></div>}
      <small className="learning-tap-hint">Toque para comparar</small>
    </div>}

    {card.type === "STEPS" && items.length > 0 && <ol className="learning-steps">
      {items.map((item, index) => <li key={`${item.label}-${index}`}><span>{index + 1}</span><div><strong>{item.label}</strong><p>{item.description}</p></div></li>)}
    </ol>}

    {card.type !== "COMPARISON" && card.type !== "STEPS" && items.length > 0 && <div className="learning-mini-grid">
      {items.map((item, index) => <div key={`${item.label}-${index}`}><span aria-hidden="true">{item.emoji || "✦"}</span><strong>{item.label}</strong><p>{item.description}</p></div>)}
    </div>}
  </article>;
}
