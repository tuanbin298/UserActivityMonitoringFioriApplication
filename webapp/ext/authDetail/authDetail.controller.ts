import Controller from "sap/fe/core/PageController";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Formatter from "useraudit/formatter/Formatter";

export default class authDetail extends Controller {
  public formatter = Formatter;

  public onInit(): void {
    super.onInit();
    const oRouter = (this as any).getAppComponent().getRouter();
    if (oRouter) {
      // Lắng nghe sự kiện điều hướng đến trang Detail
      oRouter
        .getRoute("authDetail")
        .attachPatternMatched(this._onObjectMatched, this);
    }
  }

  private async _onObjectMatched(oEvent: any): Promise<void> {
    const sKey = oEvent.getParameter("arguments").key;
    const oView = this.getView();
    if (!oView || !sKey) return;

    // Bật trạng thái loading cho đến khi lấy xong data
    oView.setBusy(true);

    try {
      // Bước 1: Trích xuất SessionId sạch từ tham số key
      // Ví dụ: UserAuthLog('DEV-011...') -> DEV-011...
      const sSessionId = sKey.match(/'([^']+)'/)?.[1] || sKey;

      // Bước 2: Lấy OData Model từ App Component (Giống hệt trang Main)
      const oModel = (this as any).getAppComponent().getModel() as ODataModel;

      // Bước 3: Tạo List Binding với Filter theo SessionId
      const oDetailBinding = oModel.bindList(
        "/UserAuthLog",
        undefined,
        undefined,
        [new Filter("SessionId", FilterOperator.EQ, sSessionId)],
      ) as ODataListBinding;

      // Bước 4: Gọi yêu cầu lấy dữ liệu từ Server (Manual Fetch)
      const aContexts = await oDetailBinding.requestContexts(0, 1);

      if (aContexts.length > 0) {
        const oData = aContexts[0].getObject();
        // Bước 5: Đưa dữ liệu vào JSONModel để hiển thị lên View
        const oDetailModel = new JSONModel(oData);
        oView.setModel(oDetailModel, "detailData");
      } else {
        console.error("No data found for SessionId:", sSessionId);
      }
    } catch (oError) {
      console.error("Error fetching detail data:", oError);
    } finally {
      // Tắt trạng thái loading
      oView.setBusy(false);
    }
  }
}
