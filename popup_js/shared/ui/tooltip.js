/**
 * 文件说明：帮助提示（help tooltip）共享 UI 模块。
 * 职责：初始化帮助图标的显示、隐藏、定位与对齐行为。
 */

/**
 * 根据视口位置更新 tooltip 对齐方式。
 */
export function updateTooltipAlignment(icon) {
    if (!icon) {
        return;
    }
    const tooltip = icon.querySelector('.help-tooltip');
    if (!tooltip) {
        return;
    }
    const iconRect = icon.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 8;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const spaceBelow = window.innerHeight - iconRect.bottom;
    const spaceAbove = iconRect.top;

    if (spaceBelow < tooltipRect.height + padding && spaceAbove > spaceBelow) {
        icon.classList.add('tooltip-up');
    } else {
        icon.classList.remove('tooltip-up');
    }

    icon.classList.remove('tooltip-align-left', 'tooltip-align-right');
    const centeredLeft = iconRect.left + (iconRect.width - tooltipRect.width) / 2;
    const centeredRight = centeredLeft + tooltipRect.width;
    const shouldPreferRightAlign = iconRect.left > (viewportWidth / 2);
    if (centeredRight >= viewportWidth - padding || shouldPreferRightAlign) {
        icon.classList.add('tooltip-align-right');
    } else if (centeredLeft < padding) {
        icon.classList.add('tooltip-align-left');
    }

    tooltip.style.left = '';
    tooltip.style.top = '';
}

/**
 * 初始化帮助提示交互行为。
 */
export function initHelpTooltips(selector = '.help-icon') {
    const icons = Array.from(document.querySelectorAll(selector));
    if (icons.length === 0) {
        return {
            refresh: () => {
            }
        };
    }

    /**
     * 显示指定图标的 tooltip。
     */
    function showTooltip(icon) {
        icon.classList.add('is-visible');
        requestAnimationFrame(() => updateTooltipAlignment(icon));
    }

    /**
     * 隐藏指定图标的 tooltip。
     */
    function hideTooltip(icon) {
        icon.classList.remove('is-visible');
        icon.classList.remove('tooltip-up');
        icon.classList.remove('tooltip-align-left', 'tooltip-align-right');
    }

    /**
     * 刷新所有可见 tooltip 的位置与对齐。
     */
    function refreshVisibleTooltips() {
        icons.forEach((icon) => {
            if (icon.classList.contains('is-visible')) {
                updateTooltipAlignment(icon);
            }
        });
    }

    icons.forEach((icon) => {
        icon.addEventListener('mouseenter', () => showTooltip(icon));
        icon.addEventListener('mouseleave', () => hideTooltip(icon));
        icon.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    });

    window.addEventListener('resize', refreshVisibleTooltips);

    return {
        refresh: refreshVisibleTooltips
    };
}
