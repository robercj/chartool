import { ChevronDown, ChevronUp, Palette, User } from 'lucide-react';
import PillTagInput from './PillTagInput';
import PromptPreviewPanel from './PromptPreviewPanel';
import { BODY_TYPES } from '../../lib/constants/DERE_PRESETS';

// Shared input class for appearance fields
const FIELD_CLS = 'input input-bordered w-full bg-base-300 text-base-content';
const LABEL_CLS = 'label label-text font-medium pb-1';

export default function AppearanceForm({
  isExpanded,
  onToggle,
  appearanceData,
  onChange,
  disabled = false,
  // Optional: character data for JSON preview + seed controls inside the collapsible
  characterData = null,
  onJsonChange = null,
  onSeedChange = null,
  onSeedLockToggle = null,
}) {
  const handleFieldChange = (field, value) => {
    onChange({ ...appearanceData, [field]: value });
  };

  return (
    // Bug fix: add 'collapse-open' when expanded so DaisyUI correctly
    // reveals collapse-content (DaisyUI v5 uses grid-template-rows for animation;
    // without this class the content area stays at height 0).
    <div className={`collapse collapse-arrow border border-base-300 rounded-xl bg-base-200 ${isExpanded ? 'collapse-open' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="collapse-title flex items-center gap-2 font-medium text-base-content min-h-[56px]"
        aria-expanded={isExpanded}
      >
        <User className="w-5 h-5 text-primary flex-shrink-0" />
        + Add Detailed Appearance
        <span className="ml-auto">
          {isExpanded
            ? <ChevronUp className="w-5 h-5 opacity-60" />
            : <ChevronDown className="w-5 h-5 opacity-60" />
          }
        </span>
      </button>

      {/* collapse-content is always rendered so DaisyUI's animation works correctly.
          The actual form fields are conditionally shown via the collapse-open class above. */}
      <div className="collapse-content p-4 space-y-6">

        {/* Body & Structure */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-base-content">Body &amp; Structure</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="body-type" className={LABEL_CLS}>Body Type</label>
              <select
                id="body-type"
                value={appearanceData.body_type || ''}
                onChange={(e) => handleFieldChange('body_type', e.target.value)}
                disabled={disabled}
                className="select select-bordered w-full bg-base-300"
              >
                <option value="">Select...</option>
                {BODY_TYPES.map(type => (
                  <option key={type} value={type.toLowerCase()}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="height" className={LABEL_CLS}>Height Descriptor</label>
              <input
                id="height" type="text"
                value={appearanceData.height_descriptor || ''}
                onChange={(e) => handleFieldChange('height_descriptor', e.target.value)}
                placeholder="e.g., tall, short, 5'9&quot;"
                disabled={disabled}
                className={FIELD_CLS}
              />
            </div>
            <div>
              <label htmlFor="skin-tone" className={LABEL_CLS}>Skin Tone</label>
              <input
                id="skin-tone" type="text"
                value={appearanceData.skin_tone || ''}
                onChange={(e) => handleFieldChange('skin_tone', e.target.value)}
                placeholder="e.g., pale, tan, dark..."
                disabled={disabled}
                className={FIELD_CLS}
              />
            </div>
          </div>
        </section>

        {/* Hair & Eyes */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-base-content">Hair &amp; Eyes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PillTagInput
              id="hair-color" label="Hair Color"
              value={appearanceData.hair_color || []}
              onChange={(colors) => handleFieldChange('hair_color', colors)}
              placeholder="e.g., silver, black with blue highlights..."
              disabled={disabled}
            />
            <div>
              <label htmlFor="hair-style" className={LABEL_CLS}>Hair Style</label>
              <input
                id="hair-style" type="text"
                value={appearanceData.hair_style || ''}
                onChange={(e) => handleFieldChange('hair_style', e.target.value)}
                placeholder="e.g., long wavy ponytail, short undercut..."
                disabled={disabled}
                className={FIELD_CLS}
              />
            </div>
            <PillTagInput
              id="eye-color" label="Eye Color"
              value={appearanceData.eye_color || []}
              onChange={(colors) => handleFieldChange('eye_color', colors)}
              placeholder="e.g., emerald green, heterochromia..."
              disabled={disabled}
            />
            <div>
              <label htmlFor="eye-shape" className={LABEL_CLS}>Eye Shape</label>
              <input
                id="eye-shape" type="text"
                value={appearanceData.eye_shape || ''}
                onChange={(e) => handleFieldChange('eye_shape', e.target.value)}
                placeholder="e.g., almond-shaped, wide innocent eyes..."
                disabled={disabled}
                className={FIELD_CLS}
              />
            </div>
          </div>
        </section>

        {/* Facial Features */}
        <section>
          <h3 className="text-base font-semibold text-base-content mb-3">Facial Features</h3>
          <PillTagInput
            id="facial-features" label="Facial Features"
            value={appearanceData.facial_features || []}
            onChange={(features) => handleFieldChange('facial_features', features)}
            placeholder="e.g., freckles, sharp jaw, dimples, scar on left cheek..."
            disabled={disabled}
          />
        </section>

        {/* Clothing & Accessories */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-base-content flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Clothing &amp; Accessories
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="clothing-style" className={LABEL_CLS}>Clothing Style</label>
              <input
                id="clothing-style" type="text"
                value={appearanceData.clothing_style || ''}
                onChange={(e) => handleFieldChange('clothing_style', e.target.value)}
                placeholder="e.g., gothic lolita, business casual..."
                disabled={disabled}
                className={FIELD_CLS}
              />
            </div>
            <div>
              <label htmlFor="art-style" className={LABEL_CLS}>Art Style Reference</label>
              <input
                id="art-style" type="text"
                value={appearanceData.art_style_reference || ''}
                onChange={(e) => handleFieldChange('art_style_reference', e.target.value)}
                placeholder="e.g., Studio Ghibli, shounen manga, painterly..."
                disabled={disabled}
                className={FIELD_CLS}
              />
            </div>
          </div>
          <div>
            <label htmlFor="signature-outfit" className={LABEL_CLS}>Signature Outfit</label>
            <textarea
              id="signature-outfit"
              value={appearanceData.signature_outfit || ''}
              onChange={(e) => handleFieldChange('signature_outfit', e.target.value)}
              placeholder="Detailed description of their most recognizable outfit..."
              rows={3}
              disabled={disabled}
              className="textarea textarea-bordered w-full bg-base-300 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PillTagInput
              id="accessories" label="Accessories"
              value={appearanceData.accessories || []}
              onChange={(items) => handleFieldChange('accessories', items)}
              placeholder="e.g., guitar, bandanna, oversized glasses..."
              disabled={disabled}
            />
            <PillTagInput
              id="props" label="Props"
              value={appearanceData.props || []}
              onChange={(items) => handleFieldChange('props', items)}
              placeholder="Items typically shown with the character..."
              disabled={disabled}
            />
          </div>
        </section>

        {/* Visual Motifs */}
        <section>
          <h3 className="text-base font-semibold text-base-content mb-3">Visual Motifs</h3>
          <PillTagInput
            id="visual-motifs" label="Visual Motifs"
            value={appearanceData.visual_motifs || []}
            onChange={(motifs) => handleFieldChange('visual_motifs', motifs)}
            placeholder="Symbolic recurring elements: roses, chains, stars..."
            disabled={disabled}
          />
        </section>

        {/* ── JSON Preview + Seed Controls (embedded from former Step 3) ── */}
        {characterData && onJsonChange && onSeedChange && onSeedLockToggle && (
          <div className="pt-4 border-t border-base-300">
            <h3 className="text-base font-semibold text-base-content mb-4">Prompt Preview &amp; Seed</h3>
            <PromptPreviewPanel
              characterData={characterData}
              onJsonChange={onJsonChange}
              onSeedChange={onSeedChange}
              onSeedLockToggle={onSeedLockToggle}
              disabled={disabled}
              // onGenerate intentionally omitted — generate buttons are at step level
            />
          </div>
        )}
      </div>
    </div>
  );
}
