import { useState, useRef } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { useChatStore } from '../../store/chat-store';
import { EmojiPicker } from '../ui/EmojiPicker';
import { ipc } from '../../lib/ipc-client';
import type { Character } from '../../db/index';

interface CreateGeneTabProps {
  editCharacter?: Character;
  onClose: () => void;
}

const ERROR_MAP: Record<string, string> = {
  'auth:invalid_key': '基因序列验证失败，请检查 API Key',
  'billing:insufficient': 'DeepSeek 账户余额不足，请前往平台充值',
  'rate:limited': '请求过于频繁，请稍后重试',
  'server:error': '基因链接中断，请重试',
};

export function CreateGeneTab({ editCharacter, onClose }: CreateGeneTabProps) {
  const isEdit = !!editCharacter;
  const apiKey = useAuthStore((s) => s.apiKey);
  const createCharacter = useChatStore((s) => s.createCharacter);
  const updateCharacter = useChatStore((s) => s.updateCharacter);

  const [name, setName] = useState(editCharacter?.name ?? '');
  const [avatar, setAvatar] = useState(editCharacter?.avatar ?? '🧬');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(editCharacter?.systemPrompt ?? '');
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [published, setPublished] = useState(editCharacter?.published ?? false);

  // File import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; path: string } | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [parserMissing, setParserMissing] = useState(false);
  const [isDownloadingParser, setIsDownloadingParser] = useState(false);
  const pendingFileRef = useRef<File | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ step: string; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const canGenerate = name.trim().length >= 2 && description.trim().length > 0 && !isEdit;
  const canSave = name.trim().length >= 2 && systemPrompt.trim().length > 0;

  const processFile = async (file: File) => {
    pendingFileRef.current = file;
    setSelectedFile({ name: file.name, path: file.name });
    setIsParsing(true);
    setParseError(null);
    setParserMissing(false);
    setDocumentText(null);

    const result = await ipc.file.parse(file);
    setIsParsing(false);

    if (result.error === 'parser:missing') {
      setParserMissing(true);
    } else if (result.error) {
      setParseError(result.error);
    } else if (result.text) {
      setDocumentText(result.text);
    }
  };

  const handleDownloadParser = async () => {
    setIsDownloadingParser(true);
    const result = await ipc.file.downloadParser();
    setIsDownloadingParser(false);

    if (result.error) {
      setParseError(result.error);
      return;
    }
    setParserMissing(false);
    const file = pendingFileRef.current;
    if (file) await processFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const readImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageFile(file);
    e.target.value = '';
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drop zone itself (not a child element)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext ?? '')) {
      setParseError(`不支持的文件格式: .${ext}`);
      return;
    }

    await processFile(file);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationProgress(null);

    const result = await ipc.character.generate(
      {
        apiKey: apiKey ?? '',
        characterName: name.trim(),
        description: description.trim(),
        enableWebSearch,
        documentContext: documentText ?? undefined,
      },
      (step, message) => setGenerationProgress({ step, message }),
    );

    setIsGenerating(false);
    setGenerationProgress(null);

    if (result.error) {
      setGenerationError(ERROR_MAP[result.error] ?? ERROR_MAP['server:error']);
    } else if (result.content) {
      setSystemPrompt(result.content.trim());
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setNameError(null);

    if (name.trim().length < 2) {
      setNameError('请为数字灵魂命名为');
      return;
    }

    setIsSaving(true);

    if (isEdit) {
      await updateCharacter(editCharacter.id, {
        name: name.trim(),
        avatar,
        systemPrompt: systemPrompt.trim(),
        published,
      });
    } else {
      await createCharacter({
        name: name.trim(),
        avatar,
        systemPrompt: systemPrompt.trim(),
        tags: [],
        isPreset: false,
        isCustom: true,
        published: published as any,
      } as any);
    }

    setIsSaving(false);
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">姓名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          placeholder="为数字灵魂命名"
          className={`w-full px-4 py-3 bg-surface border rounded-xl text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors ${
            nameError ? 'border-red-500/50' : 'border-line-strong'
          }`}
        />
        {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
      </div>

      {/* Avatar: emoji + image upload */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">头像</label>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <div className="flex items-center gap-3">
          {/* Avatar preview */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAvatarDragOver(true); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setAvatarDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setAvatarDragOver(false); }}
              onDrop={handleAvatarDrop}
              className={`w-14 h-14 flex items-center justify-center text-3xl rounded-xl border transition-colors overflow-hidden ${
                avatarDragOver
                  ? 'border-gene-purple bg-gene-purple/20'
                  : 'border-line-strong bg-surface hover:bg-surface-strong'
              }`}
            >
              {avatar.startsWith('data:') ? (
                <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                avatar
              )}
            </button>
            {showEmojiPicker && (
              <div className="absolute top-full mt-2 z-20">
                <EmojiPicker
                  onSelect={(emoji) => {
                    setAvatar(emoji);
                    setShowEmojiPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Image upload button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-surface border border-line-strong text-xs text-sub hover:bg-surface-strong transition-colors"
          >
            {avatar.startsWith('data:') ? '更换图片' : '上传图片'}
          </button>
        </div>
      </div>

      {/* Description */}
      {!isEdit && (
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述这个数字灵魂的性格、说话风格、背景故事..."
            rows={3}
            className="w-full px-4 py-3 bg-surface border border-line-strong rounded-xl text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors resize-none"
          />
        </div>
      )}

      {/* File import — create mode only */}
      {!isEdit && (
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">📎 导入参考资料（可选）</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`p-3 rounded-xl border border-dashed transition-colors space-y-2 ${
              isDragOver
                ? 'border-gene-purple/50 bg-gene-purple/5'
                : 'border-line-strong bg-surface'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-surface border border-line-strong text-xs text-sub hover:bg-surface-strong transition-colors shrink-0"
              >
                选择文件
              </button>
              <span className="text-xs text-gray-500 truncate">
                {selectedFile
                  ? selectedFile.name
                  : isDragOver
                    ? '释放文件以导入'
                    : '支持 PDF / Word / TXT，可拖拽文件到此处'}
              </span>
            </div>

            {isParsing && (
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="20" />
                </svg>
                解析中...
              </p>
            )}

            {parseError && (
              <p className="text-xs text-red-400">⚠️ 解析失败: {parseError}</p>
            )}

            {parserMissing && (
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-400">首次导入 PDF/Word 需下载解析组件（约 4MB，仅需一次）。</p>
                <button
                  type="button"
                  onClick={handleDownloadParser}
                  disabled={isDownloadingParser}
                  className="px-3 py-1.5 rounded-lg bg-gene-purple text-xs text-white hover:bg-[#5B4BD4] disabled:opacity-50 transition-colors shrink-0"
                >
                  {isDownloadingParser ? '下载中...' : '下载解析组件'}
                </button>
              </div>
            )}

            {documentText && !parseError && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-life-cyan">✅ 已解析 {documentText.length} 字</span>
                  <button
                    type="button"
                    onClick={() => setShowFilePreview(!showFilePreview)}
                    className="text-xs text-gray-500 hover:text-sub"
                  >
                    {showFilePreview ? '收起' : '预览'}
                  </button>
                </div>
                {showFilePreview && (
                  <div className="mt-2 p-3 rounded-lg bg-surface border border-line text-xs text-gray-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {documentText.slice(0, 500)}
                    {documentText.length > 500 && '...'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Web search checkbox — create mode only */}
      {!isEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.target.checked)}
            className="w-4 h-4 rounded border-line-strong bg-surface text-gene-purple focus:ring-gene-purple/30"
          />
          <span className="text-xs text-gray-400">启用联网搜索 (提高基因序列丰度)</span>
        </label>
      )}

      {/* Generate button — create mode only */}
      {!isEdit && (
        <div>
          {/* Progress indicator */}
          {isGenerating && generationProgress && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-gene-purple/5 border border-gene-purple/10 space-y-2">
              <div className="flex items-center gap-3">
                <svg className="animate-spin w-4 h-4 text-gene-purple shrink-0" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="20" />
                </svg>
                <span className="text-sm text-gene-purple">{generationProgress.message}</span>
              </div>
              <div className="flex gap-1.5">
                <div className={`h-1 rounded-full flex-1 transition-colors ${generationProgress.step === 'search' ? 'bg-gene-purple animate-pulse' : 'bg-gene-purple/30'}`} />
                <div className={`h-1 rounded-full flex-1 transition-colors ${generationProgress.step === 'generate' ? 'bg-gene-purple animate-pulse' : 'bg-surface'}`} />
              </div>
            </div>
          )}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="w-full py-3 rounded-xl bg-gene-purple hover:bg-[#5B4BD4] disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="20" />
                </svg>
                {generationProgress ? generationProgress.message : '基因测序中...'}
              </>
            ) : (
              '⚡ 全节点扫描并生成基因序列'
            )}
          </button>
          {generationError && (
            <p className="mt-2 text-xs text-red-400">{generationError}</p>
          )}
        </div>
      )}

      {/* System prompt */}
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">
          {isEdit ? '基因序列' : '生成的基因序列'}
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={isEdit ? '' : '点击上方按钮生成基因序列，或手动输入...'}
          rows={4}
          className="w-full px-4 py-3 bg-surface border border-line-strong rounded-xl text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors resize-none"
        />
        {!isEdit && systemPrompt && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-2 text-xs text-life-cyan hover:underline"
          >
            重新测序
          </button>
        )}
      </div>

      {/* Publish to gene pool — create mode only; edit mode shows toggle for published chars */}
      {!isEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 rounded border-line-strong bg-surface text-gene-purple focus:ring-gene-purple/30"
          />
          <span className="text-xs text-gray-400">发布到基因库（其他用户可在基因库中发现并使用此角色）</span>
        </label>
      )}
      {isEdit && editCharacter.published && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 rounded border-line-strong bg-surface text-gene-purple focus:ring-gene-purple/30"
          />
          <span className="text-xs text-gray-400">已发布到基因库（取消勾选将撤回）</span>
        </label>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!canSave || isSaving}
        className="w-full py-3 rounded-xl bg-life-cyan hover:bg-[#00B8B3] disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold text-[#0F0F1A] transition-colors"
      >
        {isSaving ? '保存中...' : isEdit ? '重新编译基因序列' : '培育数字灵魂'}
      </button>
    </div>
  );
}
