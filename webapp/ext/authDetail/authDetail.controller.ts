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
      oRouter
        .getRoute("authDetail")
        .attachPatternMatched(this._onObjectMatched, this);
    }
  }

  private async _onObjectMatched(oEvent: any): Promise<void> {
    const sKey = oEvent.getParameter("arguments").key;
    const oView = this.getView();
    if (!oView || !sKey) return;

    oView.setBusy(true);

    try {
      const sSessionId = sKey.match(/'([^']+)'/)?.[1] || sKey;
      const oModel = (this as any).getAppComponent().getModel() as ODataModel;
      const oDetailBinding = oModel.bindList(
        "/UserAuthLog",
        undefined,
        undefined,
        [new Filter("SessionId", FilterOperator.EQ, sSessionId)],
      ) as ODataListBinding;

      const aContexts = await oDetailBinding.requestContexts(0, 1);

      if (aContexts.length > 0) {
        const oData = aContexts[0].getObject();
        const oDetailModel = new JSONModel(oData);
        oView.setModel(oDetailModel, "detailData");
      } else {
        console.error("No data found for SessionId:", sSessionId);
      }
    } catch (oError) {
      console.error("Error fetching detail data:", oError);
    } finally {
      oView.setBusy(false);
    }
  }
}
