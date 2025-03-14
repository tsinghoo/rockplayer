//mairui.club: free: FF5BCE92-17AE-4A9D-A0E5-B4B0C20248C2

window.mhgl_screen = window.mhgl_screen || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        init: async function () {
            await self.getNodes();
        },
        getNodes: async function () {
            let res = await share.getSync__("/stock/screen/nodes");
            if (res.error) {
                $(".nodes").html(res.error);
            } else {
                let data = res.data;
                function getHtml(data, level) {
                    let strs = data.className.split(".");
                    let className = strs[strs.length - 1];
                    let resourceId = data.resourceId ? data.resourceId : "";
                    let ele = $(`
                    <div class="node clickable" style="margin-left:${level.length * 4}px">

                        <span class="childPath">${level == "" ? "" : level + ":"}</span>
                        ${className}${data.text ? "." + data.text : ""}
                        <span class="childCount">(${data.children.length})</span>
                        <span class="resourceId">${resourceId}</span>

                    </div>
                    `);

                    for (let i = 0; i < data.children.length; i++) {
                        let child = getHtml(data.children[i], level + i);
                        ele.append(child);
                    }

                    return ele;
                }

                $(".nodes").html("");
                $(".nodes").append(getHtml(data, ""));
                $(".node").click(function (e) {
                    //如果其直系子节点已展开，则折叠，否则则展开
                    e.stopPropagation();
                    let children = $(this).children().filter(".node");
                    children.toggle();
                })
                $(".childCount").click(function (e) {
                    //如果其直系子节点已展开，则折叠，否则则展开
                    e.stopPropagation();
                    let children = $(this).parent().children().filter(".node");
                    for (let i = 0; i < children.length; i++) {
                        $(children[i]).toggle();
                        let nodes = $(children[i]).children().filter(".node");
                        for (let j = 0; j < nodes.length; j++) {
                            $(nodes[j]).hide();
                        }
                    }
                })
            }
        }
    };

    $(function () {
        self.init();
    });

    return self;
})();