/**
 * buildTransformFull — 合并 translate / rotate / scale / flip 为完整 CSS transform 字符串
 *
 * 顺序：translate → rotate → scale（含翻转）
 *   translate 最先，确保位移不受旋转/缩放影响；
 *   rotate 在 scale 前，旋转轴在缩放前固定。
 *
 * 注意：editor 包的 _buildTransform 只处理 translate+rotate，
 * 这里扩展支持 scale/flipX/flipY，在 viewer 侧独立维护，不修改 editor 包。
 */

export interface FullTransformParts {
  tx:    number  // translateX px
  ty:    number  // translateY px
  deg:   number  // rotate deg
  sx:    number  // scaleX（100 = 1.0）
  sy:    number  // scaleY（100 = 1.0）
  flipX: boolean // scaleX(-1)
  flipY: boolean // scaleY(-1)
}

/** 从 CSS transform 字符串解析所有分量 */
export function parseFullTransform(transform: string): FullTransformParts {
  const tMatch = transform.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/)
  const rMatch = transform.match(/rotate\(\s*([-\d.]+)deg\s*\)/)
  // scaleX / scaleY 独立形式（翻转写法）
  const sxMatch = transform.match(/scaleX\(\s*([-\d.]+)\s*\)/)
  const syMatch = transform.match(/scaleY\(\s*([-\d.]+)\s*\)/)
  // scale(x, y) 或 scale(n) 两参数形式
  const s2Match = transform.match(/scale\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/)
  const s1Match = !s2Match ? transform.match(/scale\(\s*([-\d.]+)\s*\)/) : null

  const rawSx = sxMatch
    ? parseFloat(sxMatch[1])
    : s2Match ? parseFloat(s2Match[1])
    : s1Match ? parseFloat(s1Match[1])
    : 1

  const rawSy = syMatch
    ? parseFloat(syMatch[1])
    : s2Match ? parseFloat(s2Match[2])
    : s1Match ? parseFloat(s1Match[1])
    : 1

  // 翻转 = 绝对值为 1 且为负
  const flipX = rawSx < 0
  const flipY = rawSy < 0
  const sx    = Math.round(Math.abs(rawSx) * 100)
  const sy    = Math.round(Math.abs(rawSy) * 100)

  return {
    tx:    tMatch ? parseFloat(tMatch[1]) : 0,
    ty:    tMatch ? parseFloat(tMatch[2]) : 0,
    deg:   rMatch ? parseFloat(rMatch[1]) : 0,
    sx:    sx || 100,
    sy:    sy || 100,
    flipX,
    flipY,
  }
}

/** 将 FullTransformParts 序列化为 CSS transform 字符串 */
export function buildFullTransform(parts: FullTransformParts): string {
  const segs: string[] = []

  if (parts.tx !== 0 || parts.ty !== 0) {
    segs.push(`translate(${parts.tx}px, ${parts.ty}px)`)
  }
  if (parts.deg !== 0) {
    segs.push(`rotate(${parts.deg}deg)`)
  }

  const finalSx = (parts.sx / 100) * (parts.flipX ? -1 : 1)
  const finalSy = (parts.sy / 100) * (parts.flipY ? -1 : 1)

  if (finalSx !== 1 || finalSy !== 1) {
    if (finalSx === finalSy) {
      segs.push(`scale(${finalSx})`)
    } else {
      segs.push(`scale(${finalSx}, ${finalSy})`)
    }
  }

  return segs.join(' ') || 'none'
}
